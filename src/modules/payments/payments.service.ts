import {
  Injectable,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PaymentsRepository } from './payments.repository.js';
import { OrdersRepository } from '../orders/orders.repository.js';
import { MidtransService } from './midtrans.service.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly ordersRepository: OrdersRepository,
    private readonly midtransService: MidtransService,
    private readonly outboxService: OutboxService,
    private readonly prisma: PrismaService,
  ) {}

  async getPaymentsByOrderId(orderId: string) {
    await this.ordersRepository.findById(orderId); // ensure order exists
    return this.paymentsRepository.findByOrderId(orderId);
  }

  async getPaymentStatus(orderId: string) {
    const order = await this.ordersRepository.findById(orderId);
    const successPayments = order.payments.filter(
      (p) => p.status === PaymentStatus.SUCCESS,
    );
    let paidSoFar = new Decimal(0);
    for (const p of successPayments) {
      paidSoFar = paidSoFar.plus(p.amount);
    }
    const grandTotal = new Decimal(order.grandTotal);
    const remaining = grandTotal.minus(paidSoFar);

    return {
      orderId: order.id,
      paidSoFar: paidSoFar.toString(),
      grandTotal: grandTotal.toString(),
      remaining: remaining.toString(),
      payments: order.payments.map((p) => ({
        id: p.id,
        method: p.paymentMethod,
        status: p.status,
        amount: p.amount.toString(),
        midtransTransactionId: p.midtransTransactionId,
      })),
      orderStatus: order.status,
    };
  }

  async createPayment(
    orderId: string,
    idempotencyKey: string | undefined,
    dto: CreatePaymentDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    const { method, amount, cashReceived, referenceNumber } = dto;
    const amountDecimal = new Decimal(amount);

    // 6 & 7: Midtrans handling OUTSIDE the transaction first if MIDTRANS_*
    let midtransResponse: unknown = null;
    const isMidtrans =
      method === PaymentMethod.MIDTRANS_QRIS ||
      method === PaymentMethod.MIDTRANS_GOPAY ||
      method === PaymentMethod.MIDTRANS_VA;

    // We need orderNumber for Midtrans charge, let's fetch order briefly or do inside transaction.
    // Wait, the prompt says: "call the Midtrans Core API charge OUTSIDE the transaction first to get the charge response"
    // To get orderNumber, let's fetch the order first.
    const tempOrder = await this.ordersRepository.findById(orderId);
    if (
      tempOrder.status === OrderStatus.CANCELLED ||
      tempOrder.status === OrderStatus.REFUNDED
    ) {
      throw new ConflictException(`Order status is ${tempOrder.status}`);
    }

    if (isMidtrans) {
      midtransResponse = await this.midtransService.charge(
        tempOrder.orderNumber,
        amount,
        method,
      );
    }

    // Now inside ONE prisma.$transaction:
    return this.prisma.$transaction(async (tx) => {
      // 1. Find payment by idempotencyKey — if exists return it
      const existing = await this.paymentsRepository.findByIdempotencyKey(
        idempotencyKey,
        tx,
      );
      if (existing) {
        return existing;
      }

      // 2. Load the order; must not be CANCELLED/REFUNDED
      const order = await this.ordersRepository.findById(orderId);
      if (
        order.status === OrderStatus.CANCELLED ||
        order.status === OrderStatus.REFUNDED
      ) {
        throw new ConflictException(`Order status is ${order.status}`);
      }

      // 3. Compute paidSoFar = sum of payments with status SUCCESS for the order
      const successPayments = order.payments.filter(
        (p) => p.status === PaymentStatus.SUCCESS,
      );
      let paidSoFar = new Decimal(0);
      for (const p of successPayments) {
        paidSoFar = paidSoFar.plus(p.amount);
      }

      // 4. Validate amount <= grandTotal - paidSoFar
      const grandTotal = new Decimal(order.grandTotal);
      const remaining = grandTotal.minus(paidSoFar);
      if (amountDecimal.greaterThan(remaining)) {
        throw new ConflictException('Payment exceeds remaining total');
      }

      let paymentStatus: PaymentStatus = PaymentStatus.PENDING;
      let cashChangeDecimal: Decimal | null = null;
      let cashReceivedDecimal: Decimal | null = null;
      let midtransTxId: string | null = null;

      // 5. CASH: require cashReceived >= amount; cashChange = cashReceived - amount; status = SUCCESS immediately
      if (method === PaymentMethod.CASH) {
        if (cashReceived === undefined || cashReceived === null) {
          throw new BadRequestException(
            'cashReceived is required for CASH payment',
          );
        }
        cashReceivedDecimal = new Decimal(cashReceived);
        if (cashReceivedDecimal.lessThan(amountDecimal)) {
          throw new BadRequestException(
            'cashReceived is less than payment amount',
          );
        }
        cashChangeDecimal = cashReceivedDecimal.minus(amountDecimal);
        paymentStatus = PaymentStatus.SUCCESS;
      }
      // 6. EDC_MANUAL: require referenceNumber; status = SUCCESS immediately
      else if (method === PaymentMethod.EDC_MANUAL) {
        if (!referenceNumber) {
          throw new BadRequestException(
            'referenceNumber is required for EDC_MANUAL payment',
          );
        }
        paymentStatus = PaymentStatus.SUCCESS;
      }
      // 7. MIDTRANS_*: status = PENDING, midtransTransactionId = response.transaction_id
      else if (isMidtrans) {
        paymentStatus = PaymentStatus.PENDING;
        midtransTxId =
          typeof midtransResponse === 'object' &&
          midtransResponse !== null &&
          'transaction_id' in midtransResponse
            ? String(
                (midtransResponse as Record<string, unknown>).transaction_id,
              )
            : null;
      }

      const payment = await this.paymentsRepository.create(
        {
          orderId,
          paymentMethod: method,
          amount: amountDecimal,
          cashReceived: cashReceivedDecimal,
          cashChange: cashChangeDecimal,
          referenceNumber,
          midtransTransactionId: midtransTxId,
          status: paymentStatus,
          idempotencyKey,
        },
        tx,
      );

      // 8. After creating a SUCCESS payment, if paidSoFar + amount >= grandTotal -> order = COMPLETED + OutboxEvent
      const newPaidSoFar = paidSoFar.plus(amountDecimal);
      if (
        paymentStatus === PaymentStatus.SUCCESS &&
        newPaidSoFar.greaterThanOrEqualTo(grandTotal)
      ) {
        await this.ordersRepository.update(
          orderId,
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
          orderId,
          'ORDER_COMPLETED',
          {
            orderId: order.id,
            orderNumber: order.orderNumber,
            storeId: order.storeId,
            warehouseId: order.storeId,
            items: itemsPayload,
          },
          tx,
        );
      }

      return payment;
    });
  }
}
