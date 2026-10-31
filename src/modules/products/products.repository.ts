import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma, ProductCategory } from '@prisma/client';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

@Injectable()
export class ProductsRepository {
  constructor(private prisma: PrismaService) {}

  async findAll(
    storeId: string,
    search?: string,
    category?: ProductCategory,
    activeOnly: boolean = true,
  ) {
    const where: Prisma.ProductWhereInput = {
      storeId,
    };

    if (activeOnly) {
      where.isActive = true;
    }

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.product.findMany({
      where,
      include: {
        modifiers: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, storeId?: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        modifiers: true,
      },
    });
    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }
    if (storeId && product.storeId !== storeId) {
      throw new NotFoundException(
        `Product with id ${id} does not belong to store ${storeId}`,
      );
    }
    return product;
  }

  async create(dto: CreateProductDto) {
    const store = await this.prisma.store.findUnique({
      where: { id: dto.storeId },
    });
    if (!store) {
      throw new NotFoundException(`Store with id '${dto.storeId}' not found`);
    }
    const { modifiers, ...productData } = dto;
    try {
      return await this.prisma.product.create({
        data: {
          ...productData,
          modifiers: modifiers
            ? {
                create: modifiers.map((mod) => ({
                  name: mod.name,
                  priceDelta: mod.priceDelta,
                })),
              }
            : undefined,
        },
        include: {
          modifiers: true,
        },
      });
    } catch (error: any) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Product with SKU ${dto.sku} already exists in this store`,
        );
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateProductDto, storeId?: string) {
    await this.findById(id, storeId);
    const { modifiers, ...productData } = dto;

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (modifiers) {
          await tx.productModifier.deleteMany({
            where: { productId: id },
          });
        }

        return tx.product.update({
          where: { id },
          data: {
            ...productData,
            modifiers: modifiers
              ? {
                  create: modifiers.map((mod) => ({
                    name: mod.name,
                    priceDelta: mod.priceDelta,
                  })),
                }
              : undefined,
          },
          include: {
            modifiers: true,
          },
        });
      });
    } catch (error: any) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Product with SKU already exists in this store`,
        );
      }
      throw error;
    }
  }

  async softDelete(id: string, storeId?: string) {
    await this.findById(id, storeId);
    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
      include: {
        modifiers: true,
      },
    });
  }

  async upsertBySku(
    storeId: string,
    data: {
      sku: string;
      name: string;
      description?: string;
      category: ProductCategory;
      price: number;
      isTrackStock?: boolean;
      isActive?: boolean;
      imageUrl?: string;
      modifiers?: { name: string; priceDelta: number }[];
    },
  ) {
    const existing = await this.prisma.product.findUnique({
      where: { storeId_sku: { storeId, sku: data.sku } },
    });

    const { modifiers, ...productData } = data;

    if (existing) {
      return this.prisma.$transaction(async (tx) => {
        if (modifiers) {
          await tx.productModifier.deleteMany({
            where: { productId: existing.id },
          });
        }
        return tx.product.update({
          where: { id: existing.id },
          data: {
            ...productData,
            modifiers: modifiers
              ? {
                  create: modifiers.map((mod) => ({
                    name: mod.name,
                    priceDelta: mod.priceDelta,
                  })),
                }
              : undefined,
          },
          include: {
            modifiers: true,
          },
        });
      });
    }

    return this.prisma.product.create({
      data: {
        storeId,
        ...productData,
        modifiers: modifiers
          ? {
              create: modifiers.map((mod) => ({
                name: mod.name,
                priceDelta: mod.priceDelta,
              })),
            }
          : undefined,
      },
      include: {
        modifiers: true,
      },
    });
  }
}
