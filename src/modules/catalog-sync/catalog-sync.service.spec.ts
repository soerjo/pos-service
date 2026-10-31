import { BadRequestException, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProductCategory } from '@prisma/client';
import { CatalogSyncService } from './catalog-sync.service.js';
import { ProductsRepository } from '../products/products.repository.js';
import { StoresService } from '../stores/stores.service.js';
import { InterServiceHttpClient } from '../../common/http-client/http-client.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SyncCatalogItemDto } from './dto/sync-catalog-item.dto.js';

describe('CatalogSyncService', () => {
  let service: CatalogSyncService;
  let productsRepository: { upsertBySku: jest.Mock };
  let storesService: { validateStore: jest.Mock };
  let httpClient: { get: jest.Mock };
  let configService: { get: jest.Mock };
  let prisma: {
    product: {
      count: jest.Mock;
      groupBy: jest.Mock;
      findFirst: jest.Mock;
    };
  };

  const mockStore = {
    id: 'store-1',
    code: 'STR01',
    name: 'Main Branch',
    organizationId: 'org-1',
    isActive: true,
  };

  beforeEach(() => {
    productsRepository = {
      upsertBySku: jest.fn(),
    };
    storesService = {
      validateStore: jest.fn().mockResolvedValue(mockStore),
    };
    httpClient = {
      get: jest.fn(),
    };
    configService = {
      get: jest.fn(),
    };
    prisma = {
      product: {
        count: jest.fn(),
        groupBy: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    service = new CatalogSyncService(
      productsRepository as unknown as ProductsRepository,
      storesService as unknown as StoresService,
      httpClient as unknown as InterServiceHttpClient,
      configService as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('syncCatalogBatch', () => {
    const validItems: SyncCatalogItemDto[] = [
      {
        sku: 'SKU-001',
        name: 'Caramel Macchiato',
        description: 'Rich espresso with caramel',
        price: 35000,
        category: ProductCategory.FOOD_AND_BEVERAGE,
        isTrackStock: true,
        isActive: true,
      },
    ];

    it('throws BadRequestException if storeId is missing', async () => {
      await expect(
        service.syncCatalogBatch('org-1', '', validItems),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.syncCatalogBatch('org-1', '', validItems),
      ).rejects.toThrow('storeId is required');
    });

    it('throws BadRequestException if items is empty or not an array', async () => {
      await expect(
        service.syncCatalogBatch('org-1', 'store-1', []),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.syncCatalogBatch(
          'org-1',
          'store-1',
          null as unknown as SyncCatalogItemDto[],
        ),
      ).rejects.toThrow('items array must contain at least one item');
    });

    it('validates store through storesService', async () => {
      productsRepository.upsertBySku.mockResolvedValue({ id: 'prod-1' });

      await service.syncCatalogBatch('org-1', 'store-1', validItems);

      expect(storesService.validateStore).toHaveBeenCalledWith(
        'store-1',
        'org-1',
      );
    });

    it('throws BadRequestException if an item is missing required fields (sku/name/price)', async () => {
      const invalidItem: SyncCatalogItemDto = {
        sku: '',
        name: 'Coffee',
        price: 20000,
        category: ProductCategory.FOOD_AND_BEVERAGE,
      };

      await expect(
        service.syncCatalogBatch('org-1', 'store-1', [invalidItem]),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.syncCatalogBatch('org-1', 'store-1', [invalidItem]),
      ).rejects.toThrow(
        'Invalid catalog item: sku, name, and price are required',
      );
    });

    it('throws BadRequestException if an item has negative price', async () => {
      const negativePriceItem: SyncCatalogItemDto = {
        sku: 'SKU-NEG',
        name: 'Negative Price Item',
        price: -500,
        category: ProductCategory.FOOD_AND_BEVERAGE,
      };

      await expect(
        service.syncCatalogBatch('org-1', 'store-1', [negativePriceItem]),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.syncCatalogBatch('org-1', 'store-1', [negativePriceItem]),
      ).rejects.toThrow(
        'Invalid price for SKU SKU-NEG: price cannot be negative',
      );
    });

    it('successfully syncs items and returns CatalogSyncResult', async () => {
      const upsertedProduct = {
        id: 'prod-1',
        sku: 'SKU-001',
        name: 'Caramel Macchiato',
        price: 35000,
      };
      productsRepository.upsertBySku.mockResolvedValue(upsertedProduct);

      const result = await service.syncCatalogBatch(
        'org-1',
        'store-1',
        validItems,
      );

      expect(productsRepository.upsertBySku).toHaveBeenCalledWith('store-1', {
        sku: 'SKU-001',
        name: 'Caramel Macchiato',
        description: 'Rich espresso with caramel',
        category: ProductCategory.FOOD_AND_BEVERAGE,
        price: 35000,
        isTrackStock: true,
        isActive: true,
        imageUrl: undefined,
        modifiers: undefined,
      });

      expect(result).toMatchObject({
        success: true,
        storeId: 'store-1',
        storeCode: 'STR01',
        storeName: 'Main Branch',
        organizationId: 'org-1',
        syncedCount: 1,
        items: [upsertedProduct],
      });
      expect(result.syncedAt).toBeInstanceOf(Date);
    });
  });

  describe('syncFromErp', () => {
    it('throws BadRequestException if storeId is missing', async () => {
      await expect(service.syncFromErp('org-1', '')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.syncFromErp('org-1', '')).rejects.toThrow(
        'storeId is required',
      );
    });

    it('throws BadGatewayException when ERP HTTP request fails', async () => {
      httpClient.get.mockRejectedValue(new Error('Connection refused'));

      await expect(
        service.syncFromErp('org-1', 'store-1', 'http://erp.local'),
      ).rejects.toThrow(BadGatewayException);
      await expect(
        service.syncFromErp('org-1', 'store-1', 'http://erp.local'),
      ).rejects.toThrow(
        'Failed to fetch catalog from ERP core service: Connection refused',
      );
    });

    it('handles non-Error objects thrown by HTTP client', async () => {
      httpClient.get.mockRejectedValue('Network timeout');

      await expect(
        service.syncFromErp('org-1', 'store-1', 'http://erp.local'),
      ).rejects.toThrow(BadGatewayException);
      await expect(
        service.syncFromErp('org-1', 'store-1', 'http://erp.local'),
      ).rejects.toThrow(
        'Failed to fetch catalog from ERP core service: Network timeout',
      );
    });

    it('returns empty result when ERP returns empty array', async () => {
      httpClient.get.mockResolvedValue([]);

      const result = await service.syncFromErp(
        'org-1',
        'store-1',
        'http://erp.local',
      );

      expect(result).toMatchObject({
        success: true,
        storeId: 'store-1',
        storeCode: 'STR01',
        storeName: 'Main Branch',
        organizationId: 'org-1',
        syncedCount: 0,
        items: [],
      });
    });

    it('extracts and parses items from array payload and batch syncs them', async () => {
      const erpPayload = [
        {
          sku: 'SKU-ERP-1',
          name: 'Croissant',
          category: ProductCategory.FOOD_AND_BEVERAGE,
          price: 25000,
          description: 'Butter croissant',
          isTrackStock: false,
          isActive: true,
          imageUrl: 'https://example.com/croissant.jpg',
          modifiers: [{ name: 'Extra Butter', priceDelta: 5000 }],
        },
      ];
      httpClient.get.mockResolvedValue(erpPayload);
      productsRepository.upsertBySku.mockResolvedValue({
        id: 'prod-croissant',
      });

      const result = await service.syncFromErp('org-1', 'store-1');

      expect(productsRepository.upsertBySku).toHaveBeenCalledWith('store-1', {
        sku: 'SKU-ERP-1',
        name: 'Croissant',
        category: ProductCategory.FOOD_AND_BEVERAGE,
        price: 25000,
        description: 'Butter croissant',
        isTrackStock: false,
        isActive: true,
        imageUrl: 'https://example.com/croissant.jpg',
        modifiers: [{ name: 'Extra Butter', priceDelta: 5000 }],
      });
      expect(result.syncedCount).toBe(1);
    });

    it('extracts items from wrapped object response formats (items, data, products)', async () => {
      const testCases = [
        {
          response: {
            items: [{ sku: 'SKU-1', name: 'Item 1', price: 1000 }],
          },
        },
        {
          response: {
            data: [{ sku: 'SKU-2', name: 'Item 2', price: 2000 }],
          },
        },
        {
          response: {
            products: [{ sku: 'SKU-3', name: 'Item 3', price: 3000 }],
          },
        },
      ];

      for (const tc of testCases) {
        httpClient.get.mockResolvedValue(tc.response);
        productsRepository.upsertBySku.mockResolvedValue({ id: 'p' });

        const result = await service.syncFromErp('org-1', 'store-1');
        expect(result.syncedCount).toBe(1);
      }
    });

    it('falls back to default ERP_SERVICE_URL from config or localhost:3503', async () => {
      configService.get.mockReturnValue('http://configured-erp:4000/');
      httpClient.get.mockResolvedValue([]);

      await service.syncFromErp('org-1', 'store-1');

      expect(httpClient.get).toHaveBeenCalledWith(
        'http://configured-erp:4000/api/v1/stores/store-1/catalog',
        {
          params: { storeId: 'store-1', organizationId: 'org-1' },
        },
      );
    });
  });

  describe('getSyncStatus', () => {
    it('throws BadRequestException if storeId is missing', async () => {
      await expect(service.getSyncStatus('org-1', '')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getSyncStatus('org-1', '')).rejects.toThrow(
        'storeId is required',
      );
    });

    it('returns aggregated product stats for the store', async () => {
      prisma.product.count
        .mockResolvedValueOnce(50) // totalProducts
        .mockResolvedValueOnce(42); // activeProducts

      prisma.product.groupBy.mockResolvedValue([
        {
          category: ProductCategory.FOOD_AND_BEVERAGE,
          _count: { id: 30 },
        },
        {
          category: ProductCategory.RETAIL,
          _count: { id: 20 },
        },
      ]);

      const lastUpdatedDate = new Date('2026-03-01T10:00:00Z');
      prisma.product.findFirst.mockResolvedValue({
        updatedAt: lastUpdatedDate,
      });

      const status = await service.getSyncStatus('org-1', 'store-1');

      expect(storesService.validateStore).toHaveBeenCalledWith(
        'store-1',
        'org-1',
      );
      expect(status).toEqual({
        storeId: 'store-1',
        storeCode: 'STR01',
        storeName: 'Main Branch',
        organizationId: 'org-1',
        totalProducts: 50,
        activeProducts: 42,
        inactiveProducts: 8,
        categories: {
          [ProductCategory.FOOD_AND_BEVERAGE]: 30,
          [ProductCategory.RETAIL]: 20,
        },
        lastSyncedAt: lastUpdatedDate,
      });
    });

    it('returns null lastSyncedAt when no products exist in store', async () => {
      prisma.product.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      prisma.product.groupBy.mockResolvedValue([]);
      prisma.product.findFirst.mockResolvedValue(null);

      const status = await service.getSyncStatus('org-1', 'store-1');

      expect(status.lastSyncedAt).toBeNull();
      expect(status.totalProducts).toBe(0);
      expect(status.activeProducts).toBe(0);
      expect(status.inactiveProducts).toBe(0);
    });
  });
});
