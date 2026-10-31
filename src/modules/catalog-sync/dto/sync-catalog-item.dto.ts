import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductCategory } from '@prisma/client';

export class SyncCatalogModifierDto {
  @ApiProperty({ example: 'Extra Shot' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 5000 })
  @IsNumber()
  priceDelta: number;
}

export class SyncCatalogItemDto {
  @ApiProperty({ example: 'KSP-001', description: 'Product SKU' })
  @IsString()
  @IsNotEmpty()
  sku: string;

  @ApiProperty({ example: 'Kopi Susu Gula Aren' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Signature iced coffee with palm sugar' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    enum: ProductCategory,
    example: ProductCategory.FOOD_AND_BEVERAGE,
  })
  @IsEnum(ProductCategory)
  category: ProductCategory;

  @ApiProperty({ example: 22000, description: 'Store-specific product price' })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsBoolean()
  @IsOptional()
  isTrackStock?: boolean;

  @ApiPropertyOptional({ example: true, default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'https://example.com/images/ksp-001.png' })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({ type: [SyncCatalogModifierDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SyncCatalogModifierDto)
  modifiers?: SyncCatalogModifierDto[];
}
