import {
  Injectable,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ShiftsRepository } from './shifts.repository.js';
import { OpenShiftDto } from './dto/open-shift.dto.js';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto.js';
import { CloseShiftDto } from './dto/close-shift.dto.js';
import {
  ShiftStatus,
  PaymentStatus,
  PaymentMethod,
  CashMovementType,
  Prisma,
} from '@prisma/client';

@Injectable()
export class ShiftsService {
  constructor(
    private readonly shiftsRepo: ShiftsRepository,
    private readonly prisma: PrismaService,
  ) {}

  async openShift(userId: string, dto: OpenShiftDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.shift.findFirst({
        where: {
          userId,
          storeId: dto.storeId,
          status: ShiftStatus.OPEN,
        },
      });
      if (existing) {
        throw new ConflictException('Shift already open for this store');
      }

      return tx.shift.create({
        data: {
          userId,
          storeId: dto.storeId,
          openingCash: new Prisma.Decimal(dto.openingCash),
          notes: dto.notes,
          status: ShiftStatus.OPEN,
        },
        include: {
          cashMovements: true,
        },
      });
    });
  }

  async createCashMovement(userId: string, dto: CreateCashMovementDto) {
    const shift = await this.shiftsRepo.findById(dto.shiftId);
    if (shift.userId !== userId) {
      throw new ForbiddenException('Shift does not belong to the current user');
    }
    if (shift.status !== ShiftStatus.OPEN) {
      throw new ConflictException('Shift is not open');
    }

    return this.shiftsRepo.createCashMovement({
      shiftId: dto.shiftId,
      type: dto.type,
      amount: new Prisma.Decimal(dto.amount),
      reason: dto.reason,
    });
  }

  async buildZReport(shiftId: string) {
    const shift = await this.shiftsRepo.findById(shiftId);

    const openingCash = new Prisma.Decimal(shift.openingCash);

    let cashMovementsIn = new Prisma.Decimal(0);
    let cashMovementsOut = new Prisma.Decimal(0);

    for (const cm of shift.cashMovements) {
      if (cm.type === CashMovementType.IN) {
        cashMovementsIn = cashMovementsIn.plus(cm.amount);
      } else if (cm.type === CashMovementType.OUT) {
        cashMovementsOut = cashMovementsOut.plus(cm.amount);
      }
    }

    const completedOrders = shift.orders.filter(
      (o) => o.status === 'COMPLETED',
    );
    const totalOrders = shift.orders.length;
    const completedOrdersCount = completedOrders.length;

    let grossSales = new Prisma.Decimal(0);
    let cashTotal = new Prisma.Decimal(0);
    let nonCashTotal = new Prisma.Decimal(0);

    for (const order of completedOrders) {
      grossSales = grossSales.plus(order.grandTotal);
      for (const payment of order.payments) {
        if (payment.status === PaymentStatus.SUCCESS) {
          if (payment.paymentMethod === PaymentMethod.CASH) {
            cashTotal = cashTotal.plus(payment.amount);
          } else {
            nonCashTotal = nonCashTotal.plus(payment.amount);
          }
        }
      }
    }

    const expectedCash = openingCash
      .plus(cashTotal)
      .plus(cashMovementsIn)
      .minus(cashMovementsOut)
      .toDecimalPlaces(2);

    return {
      totalOrders,
      completedOrders: completedOrdersCount,
      grossSales: grossSales.toDecimalPlaces(2),
      cashTotal: cashTotal.toDecimalPlaces(2),
      nonCashTotal: nonCashTotal.toDecimalPlaces(2),
      cashIn: cashMovementsIn.toDecimalPlaces(2),
      cashOut: cashMovementsOut.toDecimalPlaces(2),
      expectedCash,
      openingCash: openingCash.toDecimalPlaces(2),
    };
  }

  async closeShift(userId: string, dto: CloseShiftDto) {
    const shift = await this.shiftsRepo.findById(dto.shiftId);
    if (shift.userId !== userId) {
      throw new ForbiddenException('Shift does not belong to the current user');
    }
    if (shift.status !== ShiftStatus.OPEN) {
      throw new ConflictException('Shift is already closed');
    }

    const zReport = await this.buildZReport(dto.shiftId);
    const expectedCash = zReport.expectedCash;
    const actualCash = new Prisma.Decimal(dto.actualCash).toDecimalPlaces(2);
    const cashVariance = actualCash.minus(expectedCash).toDecimalPlaces(2);

    const closedShift = await this.prisma.$transaction(async (tx) => {
      return tx.shift.update({
        where: { id: dto.shiftId },
        data: {
          status: ShiftStatus.CLOSED,
          closedAt: new Date(),
          expectedCash,
          actualCash,
          notes: dto.notes ? dto.notes : shift.notes,
        },
        include: {
          cashMovements: true,
        },
      });
    });

    return {
      ...closedShift,
      cashVariance,
      zReport: {
        totalOrders: zReport.totalOrders,
        completedOrders: zReport.completedOrders,
        grossSales: zReport.grossSales,
        cashTotal: zReport.cashTotal,
        nonCashTotal: zReport.nonCashTotal,
        cashIn: zReport.cashIn,
        cashOut: zReport.cashOut,
        expectedCash: zReport.expectedCash,
        actualCash,
        variance: cashVariance,
      },
    };
  }

  async getCurrentShift(userId: string, storeId: string) {
    const shift = await this.shiftsRepo.findActiveShift(userId, storeId);
    if (!shift) {
      return null;
    }
    return shift;
  }
}
