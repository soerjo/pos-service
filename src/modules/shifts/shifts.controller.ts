import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ShiftsService } from './shifts.service.js';
import { OpenShiftDto } from './dto/open-shift.dto.js';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto.js';
import { CloseShiftDto } from './dto/close-shift.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

@ApiTags('Shifts')
@ApiBearerAuth()
@Controller('v1/shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post('open')
  async openShift(
    @CurrentUser('id') userId: string,
    @Body() dto: OpenShiftDto,
  ) {
    return this.shiftsService.openShift(userId, dto);
  }

  @Post('cash-movement')
  async createCashMovement(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCashMovementDto,
  ) {
    return this.shiftsService.createCashMovement(userId, dto);
  }

  @Post('close')
  async closeShift(
    @CurrentUser('id') userId: string,
    @Body() dto: CloseShiftDto,
  ) {
    return this.shiftsService.closeShift(userId, dto);
  }

  @Get('current')
  @ApiQuery({ name: 'storeId', required: true, type: String })
  async getCurrentShift(
    @CurrentUser('id') userId: string,
    @Query('storeId') storeId: string,
  ) {
    return this.shiftsService.getCurrentShift(userId, storeId);
  }
}
