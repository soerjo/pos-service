import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiHeader,
  ApiQuery,
} from '@nestjs/swagger';
import { CatalogSyncService } from './catalog-sync.service.js';
import { SyncCatalogBatchDto } from './dto/sync-catalog-batch.dto.js';
import { PullCatalogSyncDto } from './dto/pull-catalog-sync.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { CurrentStoreId } from '../../common/decorators/store-id.decorator.js';

@ApiTags('Catalog Sync')
@ApiBearerAuth()
@Controller('v1/catalog-sync')
export class CatalogSyncController {
  constructor(private readonly catalogSyncService: CatalogSyncService) {}

  @Post('pull')
  @ApiOperation({
    summary: 'Pull and sync product catalog & prices from ERP core service',
  })
  @ApiHeader({
    name: 'x-store-id',
    required: false,
    description: 'Active store ID',
  })
  @ApiQuery({
    name: 'storeId',
    required: false,
    description: 'Target store ID',
  })
  async pullFromErp(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentStoreId() headerStoreId?: string,
    @Query('storeId') queryStoreId?: string,
    @Body() dto?: PullCatalogSyncDto,
  ) {
    const targetStoreId = dto?.storeId || queryStoreId || headerStoreId;
    if (!targetStoreId) {
      throw new BadRequestException(
        'storeId is required (via x-store-id header, query parameter, or body)',
      );
    }
    return this.catalogSyncService.syncFromErp(
      organizationId,
      targetStoreId,
      dto?.erpBaseUrl,
    );
  }

  @Post('batch')
  @ApiOperation({
    summary: 'Batch sync product catalog and prices from ERP core service',
  })
  @ApiHeader({
    name: 'x-store-id',
    required: false,
    description: 'Active store ID',
  })
  async syncBatch(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: SyncCatalogBatchDto,
    @CurrentStoreId() headerStoreId?: string,
  ) {
    const targetStoreId = dto.storeId || headerStoreId;
    if (!targetStoreId) {
      throw new BadRequestException(
        'storeId is required (via x-store-id header or body)',
      );
    }
    return this.catalogSyncService.syncCatalogBatch(
      organizationId,
      targetStoreId,
      dto.items,
    );
  }

  @Post()
  @ApiOperation({
    summary: 'Alias to batch sync product catalog and prices',
  })
  @ApiHeader({
    name: 'x-store-id',
    required: false,
    description: 'Active store ID',
  })
  async sync(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: SyncCatalogBatchDto,
    @CurrentStoreId() headerStoreId?: string,
  ) {
    return this.syncBatch(organizationId, dto, headerStoreId);
  }

  @Get('status')
  @ApiOperation({
    summary: 'Get catalog sync summary and status for a store',
  })
  @ApiHeader({
    name: 'x-store-id',
    required: false,
    description: 'Active store ID',
  })
  @ApiQuery({
    name: 'storeId',
    required: false,
    description: 'Store ID',
  })
  async getStatus(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentStoreId() headerStoreId?: string,
    @Query('storeId') queryStoreId?: string,
  ) {
    const targetStoreId = queryStoreId || headerStoreId;
    if (!targetStoreId) {
      throw new BadRequestException(
        'storeId is required (via x-store-id header or query parameter)',
      );
    }
    return this.catalogSyncService.getSyncStatus(organizationId, targetStoreId);
  }

  @Get('status/:storeId')
  @ApiOperation({
    summary: 'Get catalog sync summary and status for a specific store ID',
  })
  async getStatusByParam(
    @Param('storeId') storeId: string,
    @CurrentUser('organizationId') organizationId: string,
  ) {
    return this.catalogSyncService.getSyncStatus(organizationId, storeId);
  }
}
