import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator.js';
import { PaymentsRepository } from '../payments/payments.repository.js';
import { OrdersRepository } from '../orders/orders.repository.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { createHash } from 'node:crypto';

export class MidtransNotificationDto {
  @IsString()
  @IsOptional()
  transaction_id?: string;

  @IsString()
  @IsOptional()
  order_id?: string;

  @IsString()
  @IsOptional()
  status_code?: string;

  @IsString()
  @IsOptional()
  gross_amount?: string;

  @IsString()
  @IsOptional()
  signature_key?: string;

  @IsString()
  @IsOptional()
  transaction_status?: string;

  [key: string]: unknown;
}

@ApiTags('Webhooks')
@Controller('v1/webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly paymentsRepository: PaymentsRepository,
    private readonly ordersRepository: OrdersRepository,
    private readonly outboxService: OutboxService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('midtrans')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Midtrans webhook notification endpoint' })
  async handleMidtransWebhook(@Body() body: MidtransNotificationDto) {
    const serverKey =
      this.configService.get<string>('MIDTRANS_SERVER_KEY') || '';
    const orderIdRaw = body.order_id || '';
    const statusCode = body.status_code || '';
    const grossAmount = body.gross_amount || '';
    const receivedSignature = body.signature_key || '';

    // Verify signature: sha512(order_id + status_code + gross_amount + MIDTRANS_SERVER_KEY) hex === body.signature_key
    const rawString = orderIdRaw + statusCode + grossAmount + serverKey;
    const computedSignature = createHash('sha512')
      .update(rawString)
      .digest('hex');

    if (computedSignature !== receivedSignature) {
      this.logger.warn('Midtrans webhook signature mismatch');
      throw new UnauthorizedException('Invalid signature');
    }

    const transactionId = body.transaction_id;
    const transactionStatus = body.transaction_status;

    if (!transactionId) {
      this.logger.warn('Midtrans webhook received without transaction_id');
      return { received: true };
    }

    // Match payment by midtransTransactionId === body.transaction_id
    const payment =
      await this.paymentsRepository.findByMidtransTransactionId(transactionId);
    if (!payment) {
      this.logger.warn(
        `Payment not found for midtrans transaction id: ${transactionId}`,
      );
      return { received: true };
    }

    if (transactionStatus === 'settlement') {
      if (payment.status === PaymentStatus.SUCCESS) {
        return { received: true }; // idempotent
      }

      await this.prisma.$transaction(async (tx) => {
        await this.paymentsRepository.update(
          payment.id,
          { status: PaymentStatus.SUCCESS },
          tx,
        );

        const order = await this.ordersRepository.findById(payment.orderId);
        const successPayments = order.payments.filter(
          (p) => p.status === PaymentStatus.SUCCESS || p.id === payment.id,
        );
        let paidSoFar = new Decimal(0);
        for (const p of successPayments) {
          paidSoFar = paidSoFar.plus(p.amount);
        }

        const grandTotal = new Decimal(order.grandTotal);
        if (
          order.status !== OrderStatus.COMPLETED &&
          paidSoFar.greaterThanOrEqualTo(grandTotal)
        ) {
          await this.ordersRepository.update(
            payment.orderId,
            { status: OrderStatus.COMPLETED },
            tx,
          );

          const itemsPayload = order.items.map((item) => ({
            sku: item.sku,
            productId: item.productId,
            quantity: item.quantity,
            isTrackStock: item.isTrackStock,
          }));

          await this.outboxService.emit(
            'ORDER',
            payment.orderId,
            'ORDER_COMPLETED',
            {
              orderId: order.id,
              orderNumber: order.orderNumber,
              storeId: order.storeId,
              items: itemsPayload,
            },
            tx,
          );
        }
      });
    } else if (transactionStatus === 'expire') {
      if (payment.status !== PaymentStatus.SUCCESS) {
        await this.paymentsRepository.update(payment.id, {
          status: PaymentStatus.EXPIRED,
        });
      }
    } else if (transactionStatus === 'cancel' || transactionStatus === 'deny') {
      if (payment.status !== PaymentStatus.SUCCESS) {
        await this.paymentsRepository.update(payment.id, {
          status: PaymentStatus.FAILED,
        });
      }
    }

    return { received: true };
  }
}
