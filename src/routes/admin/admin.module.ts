import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import { ShrimpAnalysisModule } from '../shrimp-analysis/shrimp-analysis.module';

@Module({
  imports: [AuthModule, ShrimpAnalysisModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
