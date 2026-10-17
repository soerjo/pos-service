import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { OrdersRepository } from './orders.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { OutboxModule } from '../outbox/outbox.module.js';

@Module({
  imports: [PrismaModule, OutboxModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository],
  exports: [OrdersService, OrdersRepository],
})
export class OrdersModule {}
