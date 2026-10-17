import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('v1/orders')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get(':id/payments')
  @ApiOperation({ summary: 'List payments of the order' })
  async getPayments(@Param('id') id: string) {
    return this.paymentsService.getPaymentsByOrderId(id);
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
