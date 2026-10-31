import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SyncCatalogItemDto } from './sync-catalog-item.dto.js';

export class SyncCatalogBatchDto {
  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Target store ID (optional if provided via x-store-id header)',
  })
  @IsUUID()
  @IsOptional()
  storeId?: string;

  @ApiProperty({
    type: [SyncCatalogItemDto],
    description: 'List of products and store prices to synchronize',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncCatalogItemDto)
  items: SyncCatalogItemDto[];
}
