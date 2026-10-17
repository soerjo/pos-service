import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductCategory } from '@prisma/client';

export class CreateProductModifierDto {
  @ApiProperty({ example: 'Extra Shot' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 5000 })
  @IsNumber()
  priceDelta: number;
}

export class CreateProductDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsNotEmpty()
  storeId: string;

  @ApiProperty({ example: 'KSP-001' })
  @IsString()
  @IsNotEmpty()
  sku: string;

  @ApiProperty({ example: 'Kopi Susu Gula Aren' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Delicious iced coffee' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    enum: ProductCategory,
    example: ProductCategory.FOOD_AND_BEVERAGE,
  })
  @IsEnum(ProductCategory)
  category: ProductCategory;

  @ApiProperty({ example: 22000 })
  @IsNumber()
  @Min(0.01)
  price: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  isTrackStock?: boolean;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ type: [CreateProductModifierDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateProductModifierDto)
  modifiers?: CreateProductModifierDto[];
}
