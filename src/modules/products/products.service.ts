import { Injectable } from '@nestjs/common';
import { ProductsRepository } from './products.repository.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductCategory } from '@prisma/client';

@Injectable()
export class ProductsService {
  private readonly defaultSeedProducts = [
    {
      sku: 'KSP-001',
      name: 'Kopi Susu Gula Aren',
      description: 'Signature iced coffee with palm sugar',
      category: ProductCategory.FOOD_AND_BEVERAGE,
      price: 22000,
      isTrackStock: true,
      isActive: true,
      modifiers: [
        { name: 'Extra Shot', priceDelta: 5000 },
        { name: 'Less Sugar', priceDelta: 0 },
        { name: 'Extra Ice', priceDelta: 0 },
      ],
    },
    {
      sku: 'CRL-001',
      name: 'Croffle Pistachio',
      description: 'Crispy croissant waffle with pistachio glaze',
      category: ProductCategory.FOOD_AND_BEVERAGE,
      price: 28000,
      isTrackStock: true,
      isActive: true,
    },
    {
      sku: 'THT-001',
      name: 'Teh Tarik',
      description: 'Traditional pulled milk tea',
      category: ProductCategory.FOOD_AND_BEVERAGE,
      price: 18000,
      isTrackStock: true,
      isActive: true,
      modifiers: [
        { name: 'Less Sugar', priceDelta: 0 },
        { name: 'Warm', priceDelta: 0 },
      ],
    },
    {
      sku: 'AM-600',
      name: 'Air Mineral 600ml',
      description: 'Bottled mineral water',
      category: ProductCategory.RETAIL,
      price: 6000,
      isTrackStock: true,
      isActive: true,
    },
    {
      sku: 'SRV-001',
      name: 'Keramas + Blowdry',
      description: 'Hair wash and professional blowdry service',
      category: ProductCategory.SERVICE,
      price: 75000,
      isTrackStock: false,
      isActive: true,
    },
    {
      sku: 'NSG-001',
      name: 'Nasi Goreng Spesial',
      description: 'Special fried rice with egg and chicken',
      category: ProductCategory.FOOD_AND_BEVERAGE,
      price: 35000,
      isTrackStock: true,
      isActive: true,
    },
    {
      sku: 'BRG-001',
      name: 'Crispy Chicken Burger',
      description: 'Juicy crispy chicken burger with fries',
      category: ProductCategory.FOOD_AND_BEVERAGE,
      price: 42000,
      isTrackStock: true,
      isActive: true,
    },
    {
      sku: 'BAG-001',
      name: 'Tote Bag Kanvas Eksklusif',
      description: 'Exclusive canvas tote bag',
      category: ProductCategory.RETAIL,
      price: 95000,
      isTrackStock: true,
      isActive: true,
    },
    {
      sku: 'TMB-001',
      name: 'Tumbler Stainless Steel',
      description: 'Insulated stainless steel tumbler',
      category: ProductCategory.RETAIL,
      price: 125000,
      isTrackStock: true,
      isActive: true,
    },
    {
      sku: 'SRV-002',
      name: 'Potong Rambut Express',
      description: 'Quick express haircut service',
      category: ProductCategory.SERVICE,
      price: 50000,
      isTrackStock: false,
      isActive: true,
    },
  ];

  constructor(private readonly productsRepository: ProductsRepository) {}

  async findAll(
    storeId: string,
    search?: string,
    category?: ProductCategory,
    activeOnly: boolean = true,
  ) {
    return this.productsRepository.findAll(
      storeId,
      search,
      category,
      activeOnly,
    );
  }

  async findById(id: string) {
    return this.productsRepository.findById(id);
  }

  async create(dto: CreateProductDto) {
    return this.productsRepository.create(dto);
  }

  async update(id: string, dto: UpdateProductDto) {
    return this.productsRepository.update(id, dto);
  }

  async softDelete(id: string) {
    return this.productsRepository.softDelete(id);
  }

  async seed(storeId: string) {
    const results: any[] = [];
    for (const p of this.defaultSeedProducts) {
      const {
        sku,
        name,
        description,
        category,
        price,
        isTrackStock,
        isActive,
        modifiers,
      } = p;
      const createdOrExisting = await this.productsRepository.upsertBySku(
        storeId,
        {
          sku,
          name,
          description,
          category,
          price,
          isTrackStock,
          isActive,
          modifiers,
        },
      );
      results.push(createdOrExisting);
    }
    return {
      message: 'Seed completed successfully',
      count: results.length,
      data: results,
    };
  }
}
