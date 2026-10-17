import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CloseShiftDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsNotEmpty()
  shiftId: string;

  @ApiProperty({ example: 550000.0 })
  @IsNumber()
  @Min(0)
  actualCash: number;

  @ApiPropertyOptional({ example: 'Closing shift balance checked' })
  @IsString()
  @IsOptional()
  notes?: string;
}
