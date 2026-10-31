import { Test, TestingModule } from '@nestjs/testing';
import { StoresController } from './stores.controller.js';
import { StoresService } from './stores.service.js';
import { CreateStoreDto } from './dto/create-store.dto.js';
import { UpdateStoreDto } from './dto/update-store.dto.js';
import { QueryStoreDto } from './dto/query-store.dto.js';

describe('StoresController', () => {
  let controller: StoresController;

  const mockStore = {
    id: 'store-1',
    code: 'STR01',
    name: 'Main Store',
    organizationId: 'org-1',
    isActive: true,
  };

  const mockStoresService = {
    create: jest.fn(),
    findAll: jest.fn(),
    getCurrentStore: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StoresController],
      providers: [
        {
          provide: StoresService,
          useValue: mockStoresService,
        },
      ],
    }).compile();

    controller = module.get<StoresController>(StoresController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('calls storesService.create with organizationId and dto', async () => {
      const dto: CreateStoreDto = { code: 'STR01', name: 'Main Store' };
      mockStoresService.create.mockResolvedValue(mockStore);

      const result = await controller.create('org-1', dto);

      expect(mockStoresService.create).toHaveBeenCalledWith('org-1', dto);
      expect(result).toEqual(mockStore);
    });
  });

  describe('findAll', () => {
    it('calls storesService.findAll with organizationId and query', async () => {
      const query: QueryStoreDto = { page: 1, limit: 10 };
      const expected = { items: [mockStore], total: 1 };
      mockStoresService.findAll.mockResolvedValue(expected);

      const result = await controller.findAll('org-1', query);

      expect(mockStoresService.findAll).toHaveBeenCalledWith('org-1', query);
      expect(result).toEqual(expected);
    });
  });

  describe('getCurrentStore', () => {
    it('calls storesService.getCurrentStore with storeId and organizationId', async () => {
      mockStoresService.getCurrentStore.mockResolvedValue(mockStore);

      const result = await controller.getCurrentStore('store-1', 'org-1');

      expect(mockStoresService.getCurrentStore).toHaveBeenCalledWith(
        'store-1',
        'org-1',
      );
      expect(result).toEqual(mockStore);
    });
  });

  describe('findById', () => {
    it('calls storesService.findById with id and organizationId', async () => {
      mockStoresService.findById.mockResolvedValue(mockStore);

      const result = await controller.findById('store-1', 'org-1');

      expect(mockStoresService.findById).toHaveBeenCalledWith(
        'store-1',
        'org-1',
      );
      expect(result).toEqual(mockStore);
    });
  });

  describe('update', () => {
    it('calls storesService.update with id, organizationId, and dto', async () => {
      const dto: UpdateStoreDto = { name: 'New Name' };
      const updated = { ...mockStore, name: 'New Name' };
      mockStoresService.update.mockResolvedValue(updated);

      const result = await controller.update('store-1', 'org-1', dto);

      expect(mockStoresService.update).toHaveBeenCalledWith(
        'store-1',
        'org-1',
        dto,
      );
      expect(result).toEqual(updated);
    });
  });

  describe('remove', () => {
    it('calls storesService.remove with id and organizationId', async () => {
      const response = { id: 'store-1', message: 'Store removed' };
      mockStoresService.remove.mockResolvedValue(response);

      const result = await controller.remove('store-1', 'org-1');

      expect(mockStoresService.remove).toHaveBeenCalledWith('store-1', 'org-1');
      expect(result).toEqual(response);
    });
  });
});
