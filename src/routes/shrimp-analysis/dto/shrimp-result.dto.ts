import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export interface SizeMetricsDto {
  pixelLength?: number;
  estimatedLengthCm: string;
  estimatedWeightGram: string;
  sizeCategory: string;
  countPerKgEstimate?: string;
}

export interface ColorAnalysisDto {
  bodyPolygon?: number[][];
  method?: string;
  assessed?: boolean;
  status?: string;
  dominantHex?: string;
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
  assessed?: boolean;
  abnormalDetected: boolean;
  healthSummary: string;
  alerts: string[];
  details: string[];
  whiteSpotsDetected?: boolean;
  blackGillsDetected?: boolean;
  muscleOpacityDetected?: boolean;
  milkyDiseaseDetected?: boolean;
}

export interface AngleInstructionDto {
  title: string;
  desc: string;
  icon: string;
}

export interface AngleGuidanceDto {
  needsReshoot: boolean;
  confidence: number;
  threshold: number;
  warning: string;
  instructions: AngleInstructionDto[];
}

export class ShrimpResultDto {
  imageContentStatus?: 'shrimp' | 'no_shrimp' | 'uncertain' | 'unverified';
  identificationStatus?: 'identified' | 'uncertain' | 'no_shrimp';
  candidateSpecies?: string;
  classificationThreshold?: number;
  id?: string;
  imageUrl?: string;
  healthStatus?: string;
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
  angleGuidance?: AngleGuidanceDto;
}

export class ShrimpHistoryFilterDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsString()
  species?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export interface ShrimpHistoryResponseDto {
  items: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: {
    totalCount: number;
    healthyCount: number;
    warningCount: number;
    avgConfidence: number;
    speciesBreakdown: Record<string, number>;
  };
}
