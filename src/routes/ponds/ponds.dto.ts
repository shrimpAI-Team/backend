import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { PondJournalKind } from '../../generated/prisma/client';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreatePondDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;
}

export class OpenCycleDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  species!: string;

  @IsOptional()
  @IsUUID()
  analysisId?: string;
}

export class CreateJournalDto {
  @IsEnum(PondJournalKind)
  kind!: PondJournalKind;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(14)
  ph?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salinity?: number;

  @IsOptional()
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  depth?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  feedKg?: number;

  @IsOptional()
  @IsBoolean()
  simulated?: boolean;
}
