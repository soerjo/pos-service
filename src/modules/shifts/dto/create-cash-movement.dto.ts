import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export enum CashMovementTypeDto {
  IN = 'IN',
  OUT = 'OUT',
}

export class CreateCashMovementDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsNotEmpty()
  shiftId: string;

  @ApiProperty({ enum: CashMovementTypeDto, example: 'IN' })
  @IsEnum(CashMovementTypeDto)
  @IsNotEmpty()
  type: CashMovementTypeDto;

  @ApiProperty({ example: 50000.0 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ example: 'Change for cash drawer' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  reason: string;
}
