import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { OutboxModule } from '../outbox/outbox.module.js';

@Module({
  imports: [PaymentsModule, OrdersModule, OutboxModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
