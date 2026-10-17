import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  Query,
  Sse,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
  ApiQuery,
} from '@nestjs/swagger';
import { Observable, interval } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';

interface JwtPayload {
  sub?: string;
  id?: string;
  email?: string;
}

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('v1/orders')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  @Get(':id/payments')
  @ApiOperation({ summary: 'List payments of the order' })
  async getPayments(@Param('id') id: string) {
    return this.paymentsService.getPaymentsByOrderId(id);
  }

  @Get(':id/payment-status')
  @ApiOperation({ summary: 'Get payment status of the order' })
  async getPaymentStatus(@Param('id') id: string) {
    return this.paymentsService.getPaymentStatus(id);
  }

  @Public()
  @Sse(':id/payment-status/stream')
  @ApiOperation({ summary: 'Stream payment status of the order via SSE' })
  @ApiQuery({ name: 'token', required: true, description: 'JWT access token' })
  paymentStatusStream(
    @Param('id') id: string,
    @Query('token') token: string,
  ): Observable<MessageEvent> {
    if (!token) {
      throw new UnauthorizedException('Token query parameter is required');
    }

    try {
      const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
      const payload = this.jwtService.verify<JwtPayload>(token, { secret });
      const subject = payload?.sub ?? payload?.id;
      if (!payload || !subject) {
        throw new UnauthorizedException('Invalid token payload');
      }
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return interval(2000).pipe(
      switchMap(async () => {
        return this.paymentsService.getPaymentStatus(id);
      }),
      takeWhile((statusDto) => {
        return statusDto.orderStatus !== 'COMPLETED';
      }, true),
    ) as unknown as Observable<MessageEvent>;
  }

  @Post(':id/payments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a payment for an order' })
  @ApiHeader({
    name: 'idempotency-key',
    description: 'Unique key for idempotent payment processing',
    required: true,
  })
  async createPayment(
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentsService.createPayment(id, idempotencyKey, dto);
  }
}
