import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { PaymentsRepository } from './payments.repository.js';
import { MidtransService } from './midtrans.service.js';
import { OrdersModule } from '../orders/orders.module.js';
import { OutboxModule } from '../outbox/outbox.module.js';

@Module({
  imports: [OrdersModule, OutboxModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsRepository, MidtransService],
  exports: [PaymentsService, PaymentsRepository],
})
export class PaymentsModule {}
