import { Module } from '@nestjs/common';
import { CatalogSyncController } from './catalog-sync.controller.js';
import { CatalogSyncService } from './catalog-sync.service.js';
import { ProductsModule } from '../products/products.module.js';
import { StoresModule } from '../stores/stores.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, ProductsModule, StoresModule],
  controllers: [CatalogSyncController],
  providers: [CatalogSyncService],
  exports: [CatalogSyncService],
})
export class CatalogSyncModule {}
