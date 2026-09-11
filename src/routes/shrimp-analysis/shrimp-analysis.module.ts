import { Module } from '@nestjs/common';
import { ShrimpAnalysisController } from './shrimp-analysis.controller';
import { ShrimpAnalysisService } from './shrimp-analysis.service';

@Module({
  controllers: [ShrimpAnalysisController],
  providers: [ShrimpAnalysisService],
  exports: [ShrimpAnalysisService],
})
export class ShrimpAnalysisModule {}
