export interface SizeMetricsDto {
  pixelLength?: number;
  estimatedLengthCm: string;
  estimatedWeightGram: string;
  sizeCategory: string;
  countPerKgEstimate?: string;
}

export interface ColorAnalysisDto {
  dominantColor: string;
  shellTransparency: string;
  glossiness?: string;
  description: string;
}

export interface UniformityDto {
  shrimpCount: number;
  uniformityRate: string;
  rating: string;
  note?: string;
}

export interface AbnormalitiesDto {
  abnormalDetected: boolean;
  healthSummary: string;
  alerts: string[];
  details: string[];
  whiteSpotsDetected?: boolean;
  blackGillsDetected?: boolean;
  muscleOpacityDetected?: boolean;
}

export class ShrimpResultDto {
  success: boolean;
  species: string;
  scientificName: string;
  confidence: number;
  sizeEstimate?: string;
  commercialGrade?: string;
  description?: string;
  abnormalDetected: boolean;
  alerts: string[];
  modelStatus?: string;
  processingTime?: string;
  imageDimensions?: string;
  analyzedAt: string;

  sizeMetrics?: SizeMetricsDto;
  colorAnalysis?: ColorAnalysisDto;
  uniformity?: UniformityDto;
  abnormalities?: AbnormalitiesDto;
}
