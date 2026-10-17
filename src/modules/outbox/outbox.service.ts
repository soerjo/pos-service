import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OutboxStatus, Prisma } from '@prisma/client';

@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

  async emit(
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    payload: unknown,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    return client.outboxEvent.create({
      data: {
        aggregateType,
        aggregateId,
        eventType,
        payload: payload as Prisma.InputJsonValue,
        status: OutboxStatus.PENDING,
      },
    });
  }
}

@Injectable()
export class OutboxRelayService {
  private readonly logger = new Logger(OutboxRelayService.name);
  private intervalRef: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (process.env.NODE_ENV !== 'test') {
      this.intervalRef = setInterval(() => {
        this.processPendingEvents().catch((err) => {
          this.logger.error('Error processing outbox events', err);
        });
      }, 60000);
    }
  }

  onModuleDestroy() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
  }

  async processPendingEvents() {
    const events = await this.prisma.outboxEvent.findMany({
      where: { status: OutboxStatus.PENDING },
      take: 50,
      orderBy: { createdAt: 'asc' },
    });

    for (const event of events) {
      try {
        this.logger.log(
          `Publishing event ${event.eventType} for aggregate ${event.aggregateId}`,
        );
        // TODO: integrate Kafka / RabbitMQ here
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: OutboxStatus.PROCESSED,
            processedAt: new Date(),
          },
        });
      } catch (error) {
        this.logger.error(
          `Failed to process outbox event ${event.id}: ${(error as Error).message}`,
          (error as Error).stack,
        );
        await this.prisma.outboxEvent
          .update({
            where: { id: event.id },
            data: { status: OutboxStatus.FAILED },
          })
          .catch(() => {});
      }
    }
  }
}
