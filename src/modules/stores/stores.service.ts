import { Injectable, BadRequestException } from '@nestjs/common';
import { StoresRepository } from './stores.repository.js';
import { CreateStoreDto } from './dto/create-store.dto.js';
import { UpdateStoreDto } from './dto/update-store.dto.js';
import { QueryStoreDto } from './dto/query-store.dto.js';

@Injectable()
export class StoresService {
  constructor(private readonly storesRepository: StoresRepository) {}

  async create(organizationId: string, dto: CreateStoreDto) {
    const targetOrgId = dto.organizationId || organizationId;
    if (!targetOrgId) {
      throw new BadRequestException('organizationId is required');
    }

    return this.storesRepository.create({
      code: dto.code,
      name: dto.name,
      organizationId: targetOrgId,
      isActive: dto.isActive,
    });
  }

  async findAll(organizationId: string, query?: QueryStoreDto) {
    if (!organizationId) {
      throw new BadRequestException('organizationId is required');
    }
    return this.storesRepository.findAll(organizationId, query);
  }

  async findById(id: string, organizationId?: string) {
    return this.storesRepository.findById(id, organizationId);
  }

  async getCurrentStore(storeId: string, organizationId?: string) {
    if (!storeId) {
      throw new BadRequestException('storeId is required');
    }
    return this.storesRepository.findById(storeId, organizationId);
  }

  async update(id: string, organizationId: string, dto: UpdateStoreDto) {
    return this.storesRepository.update(id, organizationId, dto);
  }

  async remove(id: string, organizationId: string) {
    return this.storesRepository.remove(id, organizationId);
  }

  async validateStore(storeId: string, organizationId?: string) {
    const store = await this.storesRepository.findById(storeId, organizationId);
    if (!store.isActive) {
      throw new BadRequestException(`Store with id '${storeId}' is inactive`);
    }
    return store;
  }
}
