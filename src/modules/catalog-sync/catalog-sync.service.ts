import {
  Injectable,
  Logger,
  BadRequestException,
  BadGatewayException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProductCategory } from '@prisma/client';
import { ProductsRepository } from '../products/products.repository.js';
import { StoresService } from '../stores/stores.service.js';
import { InterServiceHttpClient } from '../../common/http-client/http-client.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SyncCatalogItemDto } from './dto/sync-catalog-item.dto.js';

export interface CatalogSyncResult {
  success: boolean;
  storeId: string;
  storeCode: string;
  storeName: string;
  organizationId: string;
  syncedCount: number;
  syncedAt: Date;
  items: unknown[];
}

export interface CatalogSyncStatus {
  storeId: string;
  storeCode: string;
  storeName: string;
  organizationId: string;
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
  categories: Record<string, number>;
  lastSyncedAt: Date | null;
}

@Injectable()
export class CatalogSyncService {
  private readonly logger = new Logger(CatalogSyncService.name);

  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly storesService: StoresService,
    private readonly httpClient: InterServiceHttpClient,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Batch upsert catalog items and store-specific prices for a validated tenant store.
   */
  async syncCatalogBatch(
    organizationId: string,
    storeId: string,
    items: SyncCatalogItemDto[],
  ): Promise<CatalogSyncResult> {
    if (!storeId) {
      throw new BadRequestException('storeId is required');
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new BadRequestException(
        'items array must contain at least one item',
      );
    }

    const store = await this.storesService.validateStore(
      storeId,
      organizationId,
    );

    const results: unknown[] = [];
    for (const item of items) {
      if (
        !item.sku ||
        !item.name ||
        item.price === undefined ||
        item.price === null
      ) {
        throw new BadRequestException(
          `Invalid catalog item: sku, name, and price are required`,
        );
      }
      if (item.price < 0) {
        throw new BadRequestException(
          `Invalid price for SKU ${item.sku}: price cannot be negative`,
        );
      }

      const upserted = await this.productsRepository.upsertBySku(storeId, {
        sku: item.sku,
        name: item.name,
        description: item.description,
        category: item.category ?? ProductCategory.FOOD_AND_BEVERAGE,
        price: item.price,
        isTrackStock: item.isTrackStock ?? true,
        isActive: item.isActive ?? true,
        imageUrl: item.imageUrl,
        modifiers: item.modifiers,
      });
      results.push(upserted);
    }

    this.logger.log(
      `Synchronized ${results.length} catalog items for store ${store.code} (${storeId}) in org ${organizationId}`,
    );

    return {
      success: true,
      storeId: store.id,
      storeCode: store.code,
      storeName: store.name,
      organizationId,
      syncedCount: results.length,
      syncedAt: new Date(),
      items: results,
    };
  }

  /**
   * Pull catalog and prices from ERP core service for a validated tenant store.
   */
  async syncFromErp(
    organizationId: string,
    storeId: string,
    customErpUrl?: string,
  ): Promise<CatalogSyncResult> {
    if (!storeId) {
      throw new BadRequestException('storeId is required');
    }

    const store = await this.storesService.validateStore(
      storeId,
      organizationId,
    );

    const baseUrl =
      customErpUrl ||
      this.configService.get<string>('ERP_SERVICE_URL') ||
      'http://localhost:3503';
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const endpoint = `${cleanUrl}/api/v1/stores/${storeId}/catalog`;

    let responseData: unknown;
    try {
      responseData = await this.httpClient.get<unknown>(endpoint, {
        params: { storeId, organizationId },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to pull catalog from ERP core service at ${endpoint}: ${message}`,
      );
      throw new BadGatewayException(
        `Failed to fetch catalog from ERP core service: ${message}`,
      );
    }

    const toStringValue = (val: unknown): string => {
      if (typeof val === 'string') return val;
      if (typeof val === 'number') return val.toString();
      return '';
    };

    const toOptionalString = (val: unknown): string | undefined => {
      if (typeof val === 'string') return val;
      if (typeof val === 'number') return val.toString();
      return undefined;
    };

    const rawItems = this.extractItemsFromErpResponse(responseData);
    const parsedItems: SyncCatalogItemDto[] = rawItems.map((raw) => {
      const item = raw as Record<string, unknown>;
      const rawCategory = toStringValue(item['category']);
      const category = Object.values(ProductCategory).includes(
        rawCategory as ProductCategory,
      )
        ? (rawCategory as ProductCategory)
        : ProductCategory.FOOD_AND_BEVERAGE;

      const rawModifiers = Array.isArray(item['modifiers'])
        ? (item['modifiers'] as Array<Record<string, unknown>>)
        : [];
      const modifiers = rawModifiers.map((mod) => ({
        name: toStringValue(mod['name']),
        priceDelta: Number(mod['priceDelta'] ?? 0),
      }));

      return {
        sku: toStringValue(item['sku']),
        name: toStringValue(item['name']),
        description: toOptionalString(item['description']),
        category,
        price: Number(item['price'] ?? 0),
        isTrackStock:
          item['isTrackStock'] !== undefined
            ? Boolean(item['isTrackStock'])
            : true,
        isActive:
          item['isActive'] !== undefined ? Boolean(item['isActive']) : true,
        imageUrl: toOptionalString(item['imageUrl']),
        modifiers: modifiers.length > 0 ? modifiers : undefined,
      };
    });

    if (parsedItems.length === 0) {
      this.logger.warn(
        `No catalog items returned from ERP core service for store ${storeId}`,
      );
      return {
        success: true,
        storeId: store.id,
        storeCode: store.code,
        storeName: store.name,
        organizationId,
        syncedCount: 0,
        syncedAt: new Date(),
        items: [],
      };
    }

    return this.syncCatalogBatch(organizationId, storeId, parsedItems);
  }

  /**
   * Get sync status and catalog statistics for a store.
   */
  async getSyncStatus(
    organizationId: string,
    storeId: string,
  ): Promise<CatalogSyncStatus> {
    if (!storeId) {
      throw new BadRequestException('storeId is required');
    }

    const store = await this.storesService.validateStore(
      storeId,
      organizationId,
    );

    const [totalProducts, activeProducts, categoriesGroup, lastProduct] =
      await Promise.all([
        this.prisma.product.count({
          where: { storeId },
        }),
        this.prisma.product.count({
          where: { storeId, isActive: true },
        }),
        this.prisma.product.groupBy({
          by: ['category'],
          where: { storeId },
          _count: { id: true },
        }),
        this.prisma.product.findFirst({
          where: { storeId },
          orderBy: { updatedAt: 'desc' },
          select: { updatedAt: true },
        }),
      ]);

    const categories: Record<string, number> = {};
    for (const group of categoriesGroup) {
      categories[group.category] = group._count.id;
    }

    return {
      storeId: store.id,
      storeCode: store.code,
      storeName: store.name,
      organizationId: store.organizationId,
      totalProducts,
      activeProducts,
      inactiveProducts: totalProducts - activeProducts,
      categories,
      lastSyncedAt: lastProduct?.updatedAt ?? null,
    };
  }

  private extractItemsFromErpResponse(response: unknown): unknown[] {
    if (Array.isArray(response)) {
      return response;
    }
    if (response && typeof response === 'object') {
      const obj = response as Record<string, unknown>;
      if (Array.isArray(obj['items'])) {
        return obj['items'];
      }
      if (Array.isArray(obj['data'])) {
        return obj['data'];
      }
      if (Array.isArray(obj['products'])) {
        return obj['products'];
      }
    }
    return [];
  }
}
