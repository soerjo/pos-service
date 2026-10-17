import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { OrdersService } from './orders.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { UpdateOrderItemsDto } from './dto/update-order-items.dto.js';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('v1/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

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
