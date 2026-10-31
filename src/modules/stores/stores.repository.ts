import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { QueryStoreDto } from './dto/query-store.dto.js';
import { UpdateStoreDto } from './dto/update-store.dto.js';

@Injectable()
export class StoresRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query?: QueryStoreDto) {
    const where: Prisma.StoreWhereInput = {
      organizationId,
    };

    if (query?.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query?.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.store.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.store.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string, organizationId?: string) {
    const store = await this.prisma.store.findUnique({
      where: { id },
    });

    if (!store) {
      throw new NotFoundException(`Store with id '${id}' not found`);
    }

    if (organizationId && store.organizationId !== organizationId) {
      throw new NotFoundException(
        `Store with id '${id}' does not belong to organization '${organizationId}'`,
      );
    }

    return store;
  }

  async findByCode(organizationId: string, code: string) {
    return this.prisma.store.findUnique({
      where: {
        organizationId_code: {
          organizationId,
          code,
        },
      },
    });
  }

  async create(data: {
    code: string;
    name: string;
    organizationId: string;
    isActive?: boolean;
  }) {
    const existing = await this.findByCode(data.organizationId, data.code);
    if (existing) {
      throw new ConflictException(
        `Store with code '${data.code}' already exists in this organization`,
      );
    }

    return this.prisma.store.create({
      data: {
        code: data.code,
        name: data.name,
        organizationId: data.organizationId,
        isActive: data.isActive ?? true,
      },
    });
  }

  async update(id: string, organizationId: string, data: UpdateStoreDto) {
    await this.findById(id, organizationId);

    if (data.code) {
      const existing = await this.findByCode(organizationId, data.code);
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Store with code '${data.code}' already exists in this organization`,
        );
      }
    }

    return this.prisma.store.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, organizationId: string) {
    await this.findById(id, organizationId);
    return this.prisma.store.delete({
      where: { id },
    });
  }
}
