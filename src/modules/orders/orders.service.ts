import { Injectable, ConflictException } from '@nestjs/common';
import { OrdersRepository } from './orders.repository.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { UpdateOrderItemsDto } from './dto/update-order-items.dto.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly prisma: PrismaService,
    private readonly outboxService: OutboxService,
  ) {}

  async createOrder(dto: CreateOrderDto) {
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    return this.prisma.$transaction(async (tx) => {
      const count = await this.ordersRepository.countOrdersOnDate(
        startOfDay,
        endOfDay,
        tx,
      );
      const seq = String(count + 1).padStart(4, '0');
      const orderNumber = `POS-${dateStr}-${seq}`;

      return this.ordersRepository.create(
        {
          storeId: dto.storeId,
          orderType: dto.orderType,
          shiftId: dto.shiftId,
          referenceTable: dto.referenceTable,
          orderNumber,
          status: OrderStatus.DRAFT,
          subtotal: 0,
          discountAmount: 0,
          taxAmount: 0,
          serviceCharge: 0,
          grandTotal: 0,
        },
        tx,
      );
    });
  }

  async updateOrderItems(id: string, dto: UpdateOrderItemsDto) {
    const order = await this.ordersRepository.findById(id);

    if (
      order.status === OrderStatus.COMPLETED ||
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.REFUNDED
    ) {
      throw new ConflictException(
        `Cannot update items for order in status ${order.status}`,
      );
    }

    const orderDiscount = new Decimal(dto.discountAmount ?? 0);
    const taxRate = new Decimal(dto.taxRate ?? 0);
    const serviceChargeRate = new Decimal(dto.serviceChargeRate ?? 0);

    let calculatedSubtotal = new Decimal(0);
    const processedItems: Array<{
      productId: string;
      sku: string;
      productName: string;
      quantity: number;
      unitPrice: Decimal;
      discountAmount: Decimal;
      subtotal: Decimal;
      isTrackStock: boolean;
      notes?: string;
      assignedStaffId?: string;
      modifiers: Array<{ modifierName: string; priceDelta: Decimal }>;
    }> = [];

    for (const itemDto of dto.items) {
      const qty = new Decimal(itemDto.quantity);
      const unitPrice = new Decimal(itemDto.unitPrice);
      const itemDiscount = new Decimal(itemDto.discountAmount ?? 0);

      let modifiersSum = new Decimal(0);
      const itemModifiers: Array<{
        modifierName: string;
        priceDelta: Decimal;
      }> = [];

      if (itemDto.modifiers) {
        for (const mod of itemDto.modifiers) {
          const delta = new Decimal(mod.priceDelta ?? 0);
          modifiersSum = modifiersSum.plus(delta);
          itemModifiers.push({
            modifierName: mod.modifierName,
            priceDelta: delta,
          });
        }
      }

      // itemSubtotal = (unitPrice * quantity) - discountAmount + sum(modifier priceDelta * quantity)
      const baseProductTotal = unitPrice.mul(qty).minus(itemDiscount);
      const totalModifiersDelta = modifiersSum.mul(qty);
      const itemSubtotal = baseProductTotal
        .plus(totalModifiersDelta)
        .toDecimalPlaces(2);

      calculatedSubtotal = calculatedSubtotal.plus(itemSubtotal);

      processedItems.push({
        productId: itemDto.productId,
        sku: itemDto.sku,
        productName: itemDto.productName,
        quantity: itemDto.quantity,
        unitPrice,
        discountAmount: itemDiscount,
        subtotal: itemSubtotal,
        isTrackStock: itemDto.isTrackStock ?? true,
        notes: itemDto.notes,
        assignedStaffId: itemDto.assignedStaffId,
        modifiers: itemModifiers,
      });
    }

    const subtotalDecimal = calculatedSubtotal.toDecimalPlaces(2);
    const taxableAmount = subtotalDecimal.minus(orderDiscount);
    const taxAmount = taxableAmount.mul(taxRate).toDecimalPlaces(2);
    const serviceCharge = taxableAmount
      .mul(serviceChargeRate)
      .toDecimalPlaces(2);
    const grandTotal = subtotalDecimal
      .minus(orderDiscount)
      .plus(taxAmount)
      .plus(serviceCharge)
      .toDecimalPlaces(2);

    return this.prisma.$transaction(async (tx) => {
      await this.ordersRepository.deleteOrderItemsAndModifiers(id, tx);

      for (const item of processedItems) {
        await tx.orderItem.create({
          data: {
            orderId: id,
            productId: item.productId,
            sku: item.sku,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountAmount: item.discountAmount,
            subtotal: item.subtotal,
            isTrackStock: item.isTrackStock,
            notes: item.notes,
            assignedStaffId: item.assignedStaffId,
            modifiers: {
              create: item.modifiers.map((m) => ({
                modifierName: m.modifierName,
                priceDelta: m.priceDelta,
              })),
            },
          },
        });
      }

      return tx.order.update({
        where: { id },
        data: {
          subtotal: subtotalDecimal,
          discountAmount: orderDiscount,
          taxAmount,
          serviceCharge,
          grandTotal,
        },
        include: {
          items: {
            include: {
              modifiers: true,
            },
          },
          payments: true,
        },
      });
    });
  }

  async holdOrder(id: string) {
    const order = await this.ordersRepository.findById(id);
    if (
      order.status !== OrderStatus.DRAFT &&
      order.status !== OrderStatus.PROCESSING
    ) {
      throw new ConflictException(
        `Cannot hold order in status ${order.status}`,
      );
    }
    return this.ordersRepository.update(id, { status: OrderStatus.HELD });
  }

  async getHeldOrders(storeId: string) {
    return this.ordersRepository.findHeldOrders(storeId);
  }

  async recallOrder(id: string) {
    const order = await this.ordersRepository.findById(id);
    if (order.status !== OrderStatus.HELD) {
      throw new ConflictException(
        `Cannot recall order in status ${order.status}`,
      );
    }
    return this.ordersRepository.update(id, { status: OrderStatus.PROCESSING });
  }

  async cancelOrder(id: string) {
    const order = await this.ordersRepository.findById(id);
    if (
      order.status !== OrderStatus.DRAFT &&
      order.status !== OrderStatus.HELD &&
      order.status !== OrderStatus.PROCESSING
    ) {
      throw new ConflictException(
        `Cannot cancel order in status ${order.status}`,
      );
    }

    const hasSuccessPayment = order.payments.some(
      (p) => p.status === PaymentStatus.SUCCESS,
    );
    if (hasSuccessPayment) {
      throw new ConflictException(
        'Cannot cancel order with a successful payment',
      );
    }

    return this.ordersRepository.update(id, { status: OrderStatus.CANCELLED });
  }

  async refundOrder(id: string) {
    const order = await this.ordersRepository.findById(id);
    if (order.status !== OrderStatus.COMPLETED) {
      throw new ConflictException(
        `Cannot refund order in status ${order.status}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedOrder = await this.ordersRepository.update(
        id,
        { status: OrderStatus.REFUNDED },
        tx,
      );

      const payload = {
        orderId: order.id,
        orderNumber: order.orderNumber,
        storeId: order.storeId,
        items: order.items.map((item) => ({
          sku: item.sku,
          productId: item.productId,
          quantity: item.quantity,
          isTrackStock: item.isTrackStock,
        })),
      };

      await this.outboxService.emit(
        'ORDER',
        order.id,
        'ORDER_REFUNDED',
        payload,
        tx,
      );

      return updatedOrder;
    });
  }
}
