import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiHeader,
} from '@nestjs/swagger';
import { StoresService } from './stores.service.js';
import { CreateStoreDto } from './dto/create-store.dto.js';
import { UpdateStoreDto } from './dto/update-store.dto.js';
import { QueryStoreDto } from './dto/query-store.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { CurrentStoreId } from '../../common/decorators/store-id.decorator.js';

@ApiTags('Stores')
@ApiBearerAuth()
@Controller('v1/stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new store for the current organization' })
  async create(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: CreateStoreDto,
  ) {
    return this.storesService.create(organizationId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List stores for the current organization' })
  async findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: QueryStoreDto,
  ) {
    return this.storesService.findAll(organizationId, query);
  }

  @Get('current')
  @ApiOperation({ summary: 'Get current store context from x-store-id header' })
  @ApiHeader({
    name: 'x-store-id',
    required: true,
    description: 'Active store ID',
  })
  async getCurrentStore(
    @CurrentStoreId({ required: true }) storeId: string,
    @CurrentUser('organizationId') organizationId: string,
  ) {
    return this.storesService.getCurrentStore(storeId, organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get store details by ID' })
  async findById(
    @Param('id') id: string,
    @CurrentUser('organizationId') organizationId: string,
  ) {
    return this.storesService.findById(id, organizationId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update store details' })
  async update(
    @Param('id') id: string,
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: UpdateStoreDto,
  ) {
    return this.storesService.update(id, organizationId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a store' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('organizationId') organizationId: string,
  ) {
    return this.storesService.remove(id, organizationId);
  }
}
