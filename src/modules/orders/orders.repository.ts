import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OrderStatus, Prisma } from '@prisma/client';

@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            modifiers: true,
          },
        },
        payments: true,
      },
    });
    if (!order) {
      throw new NotFoundException(`Order with id ${id} not found`);
    }
    return order;
  }

  async countOrdersOnDate(
    startOfDay: Date,
    endOfDay: Date,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    return client.order.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    });
  }

  async create(
    data: Prisma.OrderUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    return client.order.create({
      data,
      include: {
        items: {
          include: {
            modifiers: true,
          },
        },
        payments: true,
      },
    });
  }

  async update(
    id: string,
    data: Prisma.OrderUpdateInput,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    return client.order.update({
      where: { id },
      data,
      include: {
        items: {
          include: {
            modifiers: true,
          },
        },
        payments: true,
      },
    });
  }

  async findHeldOrders(storeId: string) {
    return this.prisma.order.findMany({
      where: {
        storeId,
        status: OrderStatus.HELD,
      },
      select: {
        id: true,
        orderNumber: true,
        referenceTable: true,
        grandTotal: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findMany(query: {
    storeId?: string;
    status?: OrderStatus;
    shiftId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {};
    if (query.storeId) where.storeId = query.storeId;
    if (query.status) where.status = query.status;
    if (query.shiftId) where.shiftId = query.shiftId;
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = query.startDate;
      if (query.endDate) where.createdAt.lte = query.endDate;
    }

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              modifiers: true,
            },
          },
          payments: true,
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async deleteOrderItemsAndModifiers(
    orderId: string,
    tx: Prisma.TransactionClient,
  ) {
    const items = await tx.orderItem.findMany({
      where: { orderId },
      select: { id: true },
    });
    const itemIds = items.map((i) => i.id);

    if (itemIds.length > 0) {
      await tx.orderItemModifier.deleteMany({
        where: { orderItemId: { in: itemIds } },
      });
      await tx.orderItem.deleteMany({
        where: { orderId },
      });
    }
  }
}
