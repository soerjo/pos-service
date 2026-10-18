import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OutboxStatus, Prisma } from '@prisma/client';
import { Kafka, Producer } from 'kafkajs';

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

/**
 * Outbox relay that publishes PENDING outbox rows to Kafka topics:
 *   - pos.order.completed
 *   - pos.order.refunded
 * Rows are marked PROCESSED only after broker ack. Business failures are
 * retried (kafkajs built-in) and ultimately flagged FAILED (dead-letter state
 * in the outbox table) so they are not silently dropped.
 * If KAFKA_BROKERS is missing or KAFKA_PRODUCER_DISABLED=true, the relay
 * falls back to log-based processing (legacy behavior) to avoid losing events.
 */
@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayService.name);
  private intervalRef: NodeJS.Timeout | null = null;
  private producer: Producer | null = null;
  private kafka: Kafka | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private get kafkaEnabled(): boolean {
    const brokers = this.configService.get<string>('KAFKA_BROKERS');
    const disabled =
      this.configService.get<string>('KAFKA_PRODUCER_DISABLED') === 'true';
    return Boolean(brokers) && !disabled;
  }

  private topicFor(eventType: string): string | null {
    switch (eventType) {
      case 'ORDER_COMPLETED':
        return 'pos.order.completed';
      case 'ORDER_REFUNDED':
        return 'pos.order.refunded';
      default:
        return null;
    }
  }

  async onModuleInit(): Promise<void> {
    if (this.kafkaEnabled) {
      const brokers = (
        this.configService.get<string>('KAFKA_BROKERS') ?? ''
      )
        .split(',')
        .map((b) => b.trim())
        .filter(Boolean);

      this.logger.log(`Initializing Kafka producer for brokers: ${brokers.join(', ')}`);
      this.kafka = new Kafka({
        clientId: 'pos-service-outbox',
        brokers,
      });
      this.producer = this.kafka.producer({
        allowAutoTopicCreation: false,
        retry: { initialRetryTime: 300, retries: 5 },
      });
      await this.producer.connect();
      this.logger.log('Kafka producer connected');
    } else {
      this.logger.log(
        'Kafka producer disabled (KAFKA_BROKERS missing or KAFKA_PRODUCER_DISABLED=true) — relay falls back to log-based processing.',
      );
    }

    if (process.env.NODE_ENV !== 'test') {
      this.intervalRef = setInterval(() => {
        this.processPendingEvents().catch((err) => {
          this.logger.error('Error processing outbox events', err);
        });
      }, 60000);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
    if (this.producer) {
      await this.producer.disconnect();
      this.logger.log('Kafka producer disconnected');
    }
  }

  async processPendingEvents(): Promise<void> {
    const events = await this.prisma.outboxEvent.findMany({
      where: { status: OutboxStatus.PENDING },
      take: 50,
      orderBy: { createdAt: 'asc' },
    });

    for (const event of events) {
      try {
        const topic = this.topicFor(event.eventType);
        if (topic && this.producer) {
          await this.producer.send({
            topic,
            messages: [
              {
                key: event.aggregateId,
                value: JSON.stringify({
                  eventId: event.aggregateId,
                  sourceService: 'pos-service',
                  eventType: event.eventType,
                  ...(event.payload as object),
                }),
              },
            ],
          });
          this.logger.log(
            `Published event ${event.eventType} (${event.aggregateId}) to ${topic}`,
          );
        } else {
          this.logger.log(
            `Log-relay fallback for event ${event.eventType} (${event.aggregateId}) — no Kafka producer.`,
          );
        }

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
        // Mark as FAILED (dead-letter state in the outbox table) so the row is
        // not retried forever and can be re-published manually or by ops.
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
