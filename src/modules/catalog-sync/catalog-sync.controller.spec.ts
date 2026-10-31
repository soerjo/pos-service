import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CatalogSyncController } from './catalog-sync.controller.js';
import { CatalogSyncService } from './catalog-sync.service.js';
import { PullCatalogSyncDto } from './dto/pull-catalog-sync.dto.js';
import { SyncCatalogBatchDto } from './dto/sync-catalog-batch.dto.js';
import { ProductCategory } from '@prisma/client';

describe('CatalogSyncController', () => {
  let controller: CatalogSyncController;

  const mockSyncResult = {
    success: true,
    storeId: 'store-1',
    storeCode: 'STR01',
    storeName: 'Main Store',
    organizationId: 'org-1',
    syncedCount: 1,
    syncedAt: new Date(),
    items: [],
  };

  const mockSyncStatus = {
    storeId: 'store-1',
    storeCode: 'STR01',
    storeName: 'Main Store',
    organizationId: 'org-1',
    totalProducts: 10,
    activeProducts: 8,
    inactiveProducts: 2,
    categories: { [ProductCategory.FOOD_AND_BEVERAGE]: 10 },
    lastSyncedAt: new Date(),
  };

  const syncFromErpMock = jest.fn();
  const syncBatchMock = jest.fn();
  const getSyncStatusMock = jest.fn();

  const mockCatalogSyncService = {
    syncFromErp: syncFromErpMock,
    syncCatalogBatch: syncBatchMock,
    getSyncStatus: getSyncStatusMock,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogSyncController],
      providers: [
        {
          provide: CatalogSyncService,
          useValue: mockCatalogSyncService,
        },
      ],
    }).compile();

    controller = module.get<CatalogSyncController>(CatalogSyncController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('pullFromErp', () => {
    it('pulls from ERP with storeId from body dto', async () => {
      const dto: PullCatalogSyncDto = {
        storeId: 'store-body',
        erpBaseUrl: 'http://erp.custom',
      };
      mockCatalogSyncService.syncFromErp.mockResolvedValue(mockSyncResult);

      const result = await controller.pullFromErp(
        'org-1',
        'store-header',
        'store-query',
        dto,
      );

      expect(syncFromErpMock).toHaveBeenCalledWith(
        'org-1',
        'store-body',
        'http://erp.custom',
      );
      expect(result).toEqual(mockSyncResult);
    });

    it('falls back to queryStoreId when dto does not contain storeId', async () => {
      mockCatalogSyncService.syncFromErp.mockResolvedValue(mockSyncResult);

      const result = await controller.pullFromErp(
        'org-1',
        'store-header',
        'store-query',
        {},
      );

      expect(syncFromErpMock).toHaveBeenCalledWith(
        'org-1',
        'store-query',
        undefined,
      );
      expect(result).toEqual(mockSyncResult);
    });

    it('falls back to headerStoreId when dto and query are missing', async () => {
      mockCatalogSyncService.syncFromErp.mockResolvedValue(mockSyncResult);

      const result = await controller.pullFromErp(
        'org-1',
        'store-header',
        undefined,
        undefined,
      );

      expect(syncFromErpMock).toHaveBeenCalledWith(
        'org-1',
        'store-header',
        undefined,
      );
      expect(result).toEqual(mockSyncResult);
    });

    it('throws BadRequestException when no storeId is provided', async () => {
      await expect(
        controller.pullFromErp('org-1', undefined, undefined, undefined),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.pullFromErp('org-1', undefined, undefined, undefined),
      ).rejects.toThrow(
        'storeId is required (via x-store-id header, query parameter, or body)',
      );
    });
  });

  describe('syncBatch', () => {
    const validBatchDto: SyncCatalogBatchDto = {
      storeId: 'store-batch',
      items: [
        {
          sku: 'SKU-1',
          name: 'Item 1',
          price: 15000,
          category: ProductCategory.FOOD_AND_BEVERAGE,
        },
      ],
    };

    it('syncs batch using storeId from body', async () => {
      mockCatalogSyncService.syncCatalogBatch.mockResolvedValue(mockSyncResult);

      const result = await controller.syncBatch(
        'org-1',
        validBatchDto,
        'store-header',
      );

      expect(syncBatchMock).toHaveBeenCalledWith(
        'org-1',
        'store-batch',
        validBatchDto.items,
      );
      expect(result).toEqual(mockSyncResult);
    });

    it('syncs batch using header storeId when body storeId is omitted', async () => {
      mockCatalogSyncService.syncCatalogBatch.mockResolvedValue(mockSyncResult);
      const dtoWithoutStoreId: SyncCatalogBatchDto = {
        items: validBatchDto.items,
      };

      const result = await controller.syncBatch(
        'org-1',
        dtoWithoutStoreId,
        'store-header',
      );

      expect(syncBatchMock).toHaveBeenCalledWith(
        'org-1',
        'store-header',
        dtoWithoutStoreId.items,
      );
      expect(result).toEqual(mockSyncResult);
    });

    it('throws BadRequestException when storeId is neither in body nor header', async () => {
      const dtoWithoutStoreId: SyncCatalogBatchDto = {
        items: validBatchDto.items,
      };

      await expect(
        controller.syncBatch('org-1', dtoWithoutStoreId, undefined),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.syncBatch('org-1', dtoWithoutStoreId, undefined),
      ).rejects.toThrow('storeId is required (via x-store-id header or body)');
    });
  });

  describe('sync', () => {
    it('aliases to syncBatch', async () => {
      mockCatalogSyncService.syncCatalogBatch.mockResolvedValue(mockSyncResult);
      const dto: SyncCatalogBatchDto = {
        storeId: 'store-1',
        items: [],
      };

      const result = await controller.sync('org-1', dto, 'store-1');

      expect(syncBatchMock).toHaveBeenCalledWith('org-1', 'store-1', dto.items);
      expect(result).toEqual(mockSyncResult);
    });
  });

  describe('getStatus', () => {
    it('retrieves sync status via queryStoreId', async () => {
      mockCatalogSyncService.getSyncStatus.mockResolvedValue(mockSyncStatus);

      const result = await controller.getStatus('org-1', 'hdr-id', 'query-id');

      expect(getSyncStatusMock).toHaveBeenCalledWith('org-1', 'query-id');
      expect(result).toEqual(mockSyncStatus);
    });

    it('retrieves sync status via headerStoreId when query is omitted', async () => {
      mockCatalogSyncService.getSyncStatus.mockResolvedValue(mockSyncStatus);

      const result = await controller.getStatus('org-1', 'hdr-id', undefined);

      expect(getSyncStatusMock).toHaveBeenCalledWith('org-1', 'hdr-id');
      expect(result).toEqual(mockSyncStatus);
    });

    it('throws BadRequestException when storeId is completely missing', async () => {
      await expect(
        controller.getStatus('org-1', undefined, undefined),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.getStatus('org-1', undefined, undefined),
      ).rejects.toThrow(
        'storeId is required (via x-store-id header or query parameter)',
      );
    });
  });

  describe('getStatusByParam', () => {
    it('retrieves sync status for specific storeId param', async () => {
      mockCatalogSyncService.getSyncStatus.mockResolvedValue(mockSyncStatus);

      const result = await controller.getStatusByParam('param-store', 'org-1');

      expect(getSyncStatusMock).toHaveBeenCalledWith('org-1', 'param-store');
      expect(result).toEqual(mockSyncStatus);
    });
  });
});
