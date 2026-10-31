import { BadRequestException } from '@nestjs/common';
import { StoresService } from './stores.service.js';
import { StoresRepository } from './stores.repository.js';
import { CreateStoreDto } from './dto/create-store.dto.js';
import { UpdateStoreDto } from './dto/update-store.dto.js';
import { QueryStoreDto } from './dto/query-store.dto.js';

describe('StoresService', () => {
  let service: StoresService;
  let repository: {
    create: jest.Mock;
    findAll: jest.Mock;
    findById: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  const mockStore = {
    id: 'store-1',
    code: 'STR01',
    name: 'Main Store',
    organizationId: 'org-1',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    service = new StoresService(repository as unknown as StoresRepository);
  });

  describe('create', () => {
    it('creates a store using the passed organizationId when dto has none', async () => {
      const dto: CreateStoreDto = {
        code: 'STR01',
        name: 'Main Store',
        isActive: true,
      };
      repository.create.mockResolvedValue(mockStore);

      const result = await service.create('org-1', dto);

      expect(repository.create).toHaveBeenCalledWith({
        code: 'STR01',
        name: 'Main Store',
        organizationId: 'org-1',
        isActive: true,
      });
      expect(result).toEqual(mockStore);
    });

    it('creates a store using dto.organizationId when provided', async () => {
      const dto: CreateStoreDto = {
        code: 'STR02',
        name: 'Second Store',
        organizationId: 'org-custom',
      };
      repository.create.mockResolvedValue({
        ...mockStore,
        organizationId: 'org-custom',
      });

      const result = await service.create('org-1', dto);

      expect(repository.create).toHaveBeenCalledWith({
        code: 'STR02',
        name: 'Second Store',
        organizationId: 'org-custom',
        isActive: undefined,
      });
      expect(result.organizationId).toBe('org-custom');
    });

    it('throws BadRequestException if no organizationId is provided', async () => {
      const dto: CreateStoreDto = {
        code: 'STR01',
        name: 'Store',
      };

      await expect(service.create('', dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create('', dto)).rejects.toThrow(
        'organizationId is required',
      );
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns stores list for valid organizationId', async () => {
      const query: QueryStoreDto = { page: 1, limit: 10, isActive: true };
      const paginatedResult = {
        items: [mockStore],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };
      repository.findAll.mockResolvedValue(paginatedResult);

      const result = await service.findAll('org-1', query);

      expect(repository.findAll).toHaveBeenCalledWith('org-1', query);
      expect(result).toEqual(paginatedResult);
    });

    it('throws BadRequestException if organizationId is missing', async () => {
      await expect(service.findAll('')).rejects.toThrow(BadRequestException);
      await expect(service.findAll('')).rejects.toThrow(
        'organizationId is required',
      );
      expect(repository.findAll).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('delegates finding by id to repository', async () => {
      repository.findById.mockResolvedValue(mockStore);

      const result = await service.findById('store-1', 'org-1');

      expect(repository.findById).toHaveBeenCalledWith('store-1', 'org-1');
      expect(result).toEqual(mockStore);
    });
  });

  describe('getCurrentStore', () => {
    it('returns store details for given storeId', async () => {
      repository.findById.mockResolvedValue(mockStore);

      const result = await service.getCurrentStore('store-1', 'org-1');

      expect(repository.findById).toHaveBeenCalledWith('store-1', 'org-1');
      expect(result).toEqual(mockStore);
    });

    it('throws BadRequestException if storeId is empty', async () => {
      await expect(service.getCurrentStore('', 'org-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getCurrentStore('', 'org-1')).rejects.toThrow(
        'storeId is required',
      );
      expect(repository.findById).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('delegates update to repository', async () => {
      const dto: UpdateStoreDto = { name: 'Updated Store' };
      const updated = { ...mockStore, name: 'Updated Store' };
      repository.update.mockResolvedValue(updated);

      const result = await service.update('store-1', 'org-1', dto);

      expect(repository.update).toHaveBeenCalledWith('store-1', 'org-1', dto);
      expect(result).toEqual(updated);
    });
  });

  describe('remove', () => {
    it('delegates remove to repository', async () => {
      const removed = { id: 'store-1', message: 'Store removed successfully' };
      repository.remove.mockResolvedValue(removed);

      const result = await service.remove('store-1', 'org-1');

      expect(repository.remove).toHaveBeenCalledWith('store-1', 'org-1');
      expect(result).toEqual(removed);
    });
  });

  describe('validateStore', () => {
    it('returns store if active', async () => {
      repository.findById.mockResolvedValue(mockStore);

      const result = await service.validateStore('store-1', 'org-1');

      expect(repository.findById).toHaveBeenCalledWith('store-1', 'org-1');
      expect(result).toEqual(mockStore);
    });

    it('throws BadRequestException if store is inactive', async () => {
      repository.findById.mockResolvedValue({ ...mockStore, isActive: false });

      await expect(service.validateStore('store-1', 'org-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.validateStore('store-1', 'org-1')).rejects.toThrow(
        "Store with id 'store-1' is inactive",
      );
    });
  });
});
