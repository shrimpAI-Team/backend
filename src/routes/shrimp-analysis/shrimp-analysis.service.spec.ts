import { ServiceUnavailableException } from '@nestjs/common';
import { ShrimpAnalysisService } from './shrimp-analysis.service';

jest.mock('fs', () => ({ ...jest.requireActual('fs'), unlinkSync: jest.fn(), writeFileSync: jest.fn() }));
jest.mock('../shared/prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Shrimp analysis failure contract', () => {
  it('falls back to the current script when a running Python server returns the old contract', async () => {
    const service = Object.create(ShrimpAnalysisService.prototype) as any;
    service.saveImageFile = jest.fn().mockReturnValue({ relativeUrl: '/image/test.jpg', savedFilename: 'test.jpg' });
    service.pythonApiUrl = 'http://localhost:8000';
    service.logger = { warn: jest.fn(), debug: jest.fn() };
    service.getScriptPath = jest.fn().mockReturnValue(__filename);
    service.getPythonPath = jest.fn().mockReturnValue('python');
    service.runPythonScript = jest.fn().mockResolvedValue({
      success: true, species: 'Tôm sú', confidence: 91, image_content_status: 'shrimp',
    });
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ success: true, analysis_contract_version: 5, species: 'Tôm sú', confidence: 91, image_content_status: 'shrimp' }),
    } as Response);
    try {
      const result = await service.analyze({ buffer: Buffer.from('image'), originalname: 'shrimp.jpg', mimetype: 'image/jpeg', size: 5 });
      expect(service.runPythonScript).toHaveBeenCalled();
      expect(result.imageContentStatus).toBe('shrimp');
      expect(result.identificationStatus).toBe('identified');
      expect(service.logger.warn).toHaveBeenCalledWith(expect.stringContaining('phiên bản cũ'));
    } finally { fetchMock.mockRestore(); }
  });
  it('saves uncertain predictions under unknown rather than the candidate species', async () => {
    const service = Object.create(ShrimpAnalysisService.prototype) as any;
    service.saveImageFile = jest.fn().mockReturnValue({ relativeUrl: '/image/test.jpg', savedFilename: 'test.jpg' });
    service.pythonApiUrl = 'http://localhost:8000';
    service.logger = { log: jest.fn() };
    service.prisma = { shrimpAnalysis: { create: jest.fn().mockResolvedValue({ id: 'saved-id' }) } };
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ success: true, analysis_contract_version: 6, species: 'Tôm sú', confidence: 35, image_content_status: 'shrimp' }),
    } as Response);
    try {
      const result = await service.analyze({ buffer: Buffer.from('image'), originalname: 'tom_su.jpg', mimetype: 'image/jpeg', size: 5 }, 'user-id');
      expect(result.id).toBe('saved-id');
      expect(service.prisma.shrimpAnalysis.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ species: 'Chưa xác định', healthStatus: 'Chưa đánh giá', description: expect.stringContaining('Gợi ý: Tôm sú') }),
      }));
    } finally { fetchMock.mockRestore(); }
  });
  it('rejects failed inference without saving a fabricated history item', async () => {
    const service = Object.create(ShrimpAnalysisService.prototype) as any;
    service.saveImageFile = jest.fn().mockReturnValue({
      relativeUrl: '/shrimp-analysis/image/test.jpg', savedFilename: 'test.jpg',
    });
    service.uploadsDir = 'test-uploads';
    service.pythonApiUrl = 'http://localhost:8000';
    service.getScriptPath = jest.fn().mockReturnValue(null);
    service.getPythonPath = jest.fn().mockReturnValue('python');
    service.prisma = { shrimpAnalysis: { create: jest.fn() } };
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ success: false, error: 'Model unavailable' }),
    } as Response);
    try {
      await expect(service.analyze({
        buffer: Buffer.from('invalid image'), originalname: 'tom_su.jpg',
        mimetype: 'image/jpeg', size: 13,
      }, 'user-id')).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(service.prisma.shrimpAnalysis.create).not.toHaveBeenCalled();
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('does not invent healthy status or commercial grade for missing fields', () => {
    const service = Object.create(ShrimpAnalysisService.prototype) as any;
    const result = service.mapToResultDto({ species: 'Tôm sú', confidence: 82 }, 'TEST');
    expect(result.healthStatus).toBe('Chưa đánh giá');
    expect(result.commercialGrade).toBe('Chưa đánh giá');
    expect(result.sizeMetrics).toBeUndefined();
    expect(result.uniformity).toBeUndefined();
  });

  it('exposes the visual finding only for identified tiger shrimp', () => {
    const service = Object.create(ShrimpAnalysisService.prototype) as any;
    const data = {
      species: 'Tôm sú', class_id: 'tom_su', confidence: 95.4, image_content_status: 'shrimp',
      abnormalities: {
        assessed: true, model_version: 'tiger_signs_v5', visual_sign: 'black_gill',
        health_summary: 'Bệnh đen mang (dự đoán qua ảnh)', details: ['Kết quả thử nghiệm qua ảnh.'],
      },
    };
    const result = service.mapToResultDto(data, 'TEST');
    expect(result.abnormalities).toMatchObject({ assessed: true, healthSummary: 'Bệnh đen mang (dự đoán qua ảnh)' });
    expect(result.alerts).toEqual(['Bệnh đen mang (dự đoán qua ảnh)']);
    expect(result.healthStatus).toBe('Chưa đánh giá');
    expect(service.mapToResultDto({ ...data, confidence: 35 }, 'TEST').abnormalities.assessed).toBe(false);
    expect(service.mapToResultDto({ ...data, class_id: 'tom_dat' }, 'TEST').abnormalities.assessed).toBe(false);

    const control = service.mapToResultDto({ ...data, abnormalities: {
      ...data.abnormalities, visual_sign: 'no_visible_target_sign', health_summary: 'Chưa thấy dấu hiệu mục tiêu qua ảnh',
    } }, 'TEST');
    expect(control.abnormalities).toMatchObject({ assessed: true, abnormalDetected: false });
    expect(control.alerts).toEqual([]);
  });

  it('does not offer shrimp suggestions before shrimp presence is checked', () => {
    const service = Object.create(ShrimpAnalysisService.prototype) as any;
    const result = service.mapToResultDto({ species: 'Tôm sú', confidence: 35 }, 'TEST');
    expect(result.species).toBe('Chưa xác định');
    expect(result.scientificName).toBe('Chưa xác định');
    expect(result.candidateSpecies).toBeUndefined();
    expect(result.identificationStatus).toBe('uncertain');
    expect(result.description).toContain('Chưa xác định ảnh có tôm');
  });

  it('preserves abstention when Python rounds a score just below the threshold', () => {
    const service = Object.create(ShrimpAnalysisService.prototype) as any;
    const result = service.mapToResultDto({
      species: 'Chưa xác định', confidence: 80, identification_status: 'uncertain',
      candidate_species: 'Tôm sú', classification_threshold: 80,
    }, 'TEST');
    expect(result.identificationStatus).toBe('uncertain');
  });

  it('rejects invalid inference and excludes unvalidated measurements', () => {
    const service = Object.create(ShrimpAnalysisService.prototype) as any;
    expect(() => service.mapToResultDto({ species: 'Tôm sú', confidence: 'invalid' }, 'TEST')).toThrow();
    const result = service.mapToResultDto({ species: 'Tôm sú', confidence: 90, image_content_status: 'shrimp',
      health_status: 'Khỏe mạnh', size_metrics: { estimated_length_cm: '15 cm' } }, 'TEST');
    expect(result.identificationStatus).toBe('identified');
    expect(result.healthStatus).toBe('Chưa đánh giá');
    expect(result.sizeMetrics).toBeUndefined();
  });

  it('returns no-shrimp results without guessing a species, guiding photography or saving history', async () => {
    const service = Object.create(ShrimpAnalysisService.prototype) as any;
    service.saveImageFile = jest.fn().mockReturnValue({ relativeUrl: '/image/test.jpg', savedFilename: 'test.jpg' });
    service.uploadsDir = 'test-uploads';
    service.pythonApiUrl = 'http://localhost:8000';
    service.prisma = { shrimpAnalysis: { create: jest.fn() } };
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ success: true, analysis_contract_version: 6, species: 'Không phát hiện tôm', confidence: 0,
        image_content_status: 'no_shrimp', identification_status: 'no_shrimp' }),
    } as Response);
    try {
      const result = await service.analyze({ buffer: Buffer.from('image'), originalname: 'anime.jpg', mimetype: 'image/jpeg', size: 5 }, 'user-id');
      expect(result.identificationStatus).toBe('no_shrimp');
      expect(result.candidateSpecies).toBeUndefined();
      expect(result.angleGuidance.needsReshoot).toBe(false);
      expect(result.imageUrl).toBeUndefined();
      expect(service.prisma.shrimpAnalysis.create).not.toHaveBeenCalled();
    } finally { fetchMock.mockRestore(); }
  });

  it('does not trust a high species score from a legacy server without input validation', () => {
    const service = Object.create(ShrimpAnalysisService.prototype) as any;
    const result = service.mapToResultDto({ species: 'Tôm sú', confidence: 99 }, 'TEST');
    expect(result.identificationStatus).toBe('uncertain');
    expect(result.imageContentStatus).toBe('unverified');
    expect(result.candidateSpecies).toBeUndefined();
  });
});
