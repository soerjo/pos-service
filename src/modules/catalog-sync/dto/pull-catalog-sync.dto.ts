import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class PullCatalogSyncDto {
  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Target store ID (optional if provided via x-store-id header)',
  })
  @IsUUID()
  @IsOptional()
  storeId?: string;

  @ApiPropertyOptional({
    example: 'http://localhost:3503',
    description:
      'Custom ERP core service base URL (defaults to ERP_SERVICE_URL env)',
  })
  @IsString()
  @IsOptional()
  erpBaseUrl?: string;
}
