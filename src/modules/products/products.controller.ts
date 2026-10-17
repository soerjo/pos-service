import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ProductsService } from './products.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductCategory } from '@prisma/client';

@ApiTags('Products')
@ApiBearerAuth()
@Controller('v1/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiQuery({ name: 'storeId', required: true, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, enum: ProductCategory })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  async findAll(
    @Query('storeId') storeId: string,
    @Query('search') search?: string,
    @Query('category') category?: ProductCategory,
    @Query('activeOnly') activeOnlyQuery?: string,
  ) {
    const activeOnly =
      activeOnlyQuery !== undefined ? activeOnlyQuery === 'true' : true;
    return this.productsService.findAll(storeId, search, category, activeOnly);
  }

  @Post('seed')
  @ApiQuery({ name: 'storeId', required: true, type: String })
  async seed(@Query('storeId') storeId: string) {
    return this.productsService.seed(storeId);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.productsService.findById(id);
  }

  @Post()
  async create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  async softDelete(@Param('id') id: string) {
    return this.productsService.softDelete(id);
  }
}
