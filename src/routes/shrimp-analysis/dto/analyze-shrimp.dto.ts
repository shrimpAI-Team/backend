import { IsOptional, IsString } from 'class-validator';

export class AnalyzeShrimpDto {
  @IsOptional()
  @IsString()
  pondId?: string;

  @IsOptional()
  @IsString()
  batchId?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
