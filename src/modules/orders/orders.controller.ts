import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiQuery,
  ApiOperation,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { UpdateOrderItemsDto } from './dto/update-order-items.dto.js';
import { OrderStatus } from '@prisma/client';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('v1/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List orders with pagination and filters' })
  @ApiQuery({ name: 'storeId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: OrderStatus })
  @ApiQuery({ name: 'shiftId', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getOrders(
    @Query('storeId') storeId?: string,
    @Query('status') status?: OrderStatus,
    @Query('shiftId') shiftId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ordersService.getOrders({
      storeId,
      status,
      shiftId,
      startDate,
      endDate,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post()
  async createOrder(@Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(dto);
  }

  @Put(':id/items')
  async updateOrderItems(
    @Param('id') id: string,
    @Body() dto: UpdateOrderItemsDto,
  ) {
    return this.ordersService.updateOrderItems(id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order details by ID' })
  async getOrderById(@Param('id') id: string) {
    return this.ordersService.getOrderById(id);
  }

  @Post(':id/hold')
  async holdOrder(@Param('id') id: string) {
    return this.ordersService.holdOrder(id);
  }

  @Get('held')
  @ApiQuery({ name: 'storeId', required: true, type: String })
  async getHeldOrders(@Query('storeId') storeId: string) {
    return this.ordersService.getHeldOrders(storeId);
  }

  @Post(':id/recall')
  async recallOrder(@Param('id') id: string) {
    return this.ordersService.recallOrder(id);
  }

  @Post(':id/cancel')
  async cancelOrder(@Param('id') id: string) {
    return this.ordersService.cancelOrder(id);
  }

  @Post(':id/refund')
  async refundOrder(@Param('id') id: string) {
    return this.ordersService.refundOrder(id);
  }
}
