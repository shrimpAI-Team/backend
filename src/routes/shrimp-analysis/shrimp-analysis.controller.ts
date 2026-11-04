import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  NotFoundException,
  Request,
} from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { FileInterceptor } from '@nestjs/platform-express';
import { ShrimpAnalysisService } from './shrimp-analysis.service';
import { Public } from '../shared/decorators/public.decorator';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { ShrimpHistoryFilterDto } from './dto/shrimp-result.dto';

@Controller('shrimp-analysis')
export class ShrimpAnalysisController {
  constructor(private readonly service: ShrimpAnalysisService) {}

  @Public()
  @Get('species')
  getSpecies() {
    return this.service.getSupportedSpecies();
  }

  @Public()
  @Get('image/:filename')
  getImage(@Param('filename') filename: string, @Res() res: any) {
    const safeFilename = path.basename(filename);
    const filePath = path.join(this.service.getUploadsDir(), safeFilename);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Hình ảnh giám định không tồn tại.');
    }

    const ext = path.extname(safeFilename).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };

    res.setHeader('Content-Type', mimeMap[ext] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(filePath);
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

  /**
   * Lấy danh sách lịch sử phân tích của người dùng hiện tại
   */
  @Get('history')
  async getHistory(
    @CurrentUser('id') userId: string,
    @Query() filter: ShrimpHistoryFilterDto,
  ) {
    return this.service.getHistory(userId, filter);
  }

  /**
   * Lấy chi tiết một mẫu phân tích
   */
  @Get('history/:id')
  async getHistoryDetail(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.service.getHistoryById(id, userId);
  }

  /**
   * Xóa một mẫu phân tích
   */
  @Delete('history/:id')
  async deleteHistoryItem(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.service.deleteHistory(id, userId);
  }

  /**
   * Xóa toàn bộ lịch sử phân tích của người dùng
   */
  @Delete('history')
  async clearAllHistory(
    @CurrentUser('id') userId: string,
  ) {
    return this.service.clearAllHistory(userId);
  }
}
