import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma, ShiftStatus } from '@prisma/client';

@Injectable()
export class ShiftsRepository {
  constructor(private prisma: PrismaService) {}

  async findActiveShift(userId: string, storeId: string) {
    return this.prisma.shift.findFirst({
      where: {
        userId,
        storeId,
        status: ShiftStatus.OPEN,
      },
      include: {
        cashMovements: true,
      },
    });
  }

  async findById(id: string) {
    const shift = await this.prisma.shift.findUnique({
      where: { id },
      include: {
        cashMovements: true,
        orders: {
          include: {
            payments: true,
          },
        },
      },
    });
    if (!shift) {
      throw new NotFoundException(`Shift with id ${id} not found`);
    }
    return shift;
  }

  async create(
    data: Prisma.ShiftUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    return client.shift.create({
      data,
      include: {
        cashMovements: true,
      },
    });
  }

  async createCashMovement(
    data: Prisma.CashMovementUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    return client.cashMovement.create({ data });
  }

  async updateShift(
    id: string,
    data: Prisma.ShiftUpdateInput,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    return client.shift.update({
      where: { id },
      data,
      include: {
        cashMovements: true,
      },
    });
  }
}
