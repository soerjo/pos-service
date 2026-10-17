import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { OrderType } from '@prisma/client';

export class CreateOrderDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsNotEmpty()
  storeId: string;

  @ApiProperty({ enum: OrderType, example: OrderType.RETAIL })
  @IsEnum(OrderType)
  @IsNotEmpty()
  orderType: OrderType;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsOptional()
  shiftId?: string;

  @ApiPropertyOptional({ example: 'Table 5' })
  @IsString()
  @IsOptional()
  referenceTable?: string;
}
