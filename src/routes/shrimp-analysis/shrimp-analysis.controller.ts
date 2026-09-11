import {
  Controller,
  Post,
  Get,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ShrimpAnalysisService } from './shrimp-analysis.service';
import { Public } from '../shared/decorators/public.decorator';

@Controller('shrimp-analysis')
export class ShrimpAnalysisController {
  constructor(private readonly service: ShrimpAnalysisService) {}

  @Public()
  @Get('species')
  getSpecies() {
    return this.service.getSupportedSpecies();
  }

  @Public()
  @Post('analyze')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 15 * 1024 * 1024 }, // Tối đa 15MB
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/i)) {
          return cb(
            new BadRequestException(
              'Chỉ chấp nhận file ảnh định dạng JPG, PNG, WEBP.',
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async analyzeShrimp(
    @UploadedFile()
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn hoặc tải lên hình ảnh tôm cần phân tích.');
    }

    const userId = req.user?.id;
    return this.service.analyze(file, userId);
  }
}
