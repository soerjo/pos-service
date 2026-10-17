import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class OpenShiftDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsNotEmpty()
  storeId: string;

  @ApiProperty({ example: 500000.0 })
  @IsNumber()
  @Min(0.01)
  openingCash: number;

  @ApiPropertyOptional({ example: 'Morning shift opening cash' })
  @IsString()
  @IsOptional()
  notes?: string;
}
