import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';
import { ProductCategory } from '@prisma/client';

describe('ProductsController', () => {
  let controller: ProductsController;
  let service: ProductsService;

  const mockProductsService = {
    findAll: () => Promise.resolve([]),
    findById: () => Promise.resolve({ id: '1', name: 'Coffee' }),
    create: () => Promise.resolve({ id: '1', name: 'Coffee' }),
    update: () => Promise.resolve({ id: '1', name: 'Coffee Updated' }),
    softDelete: () => Promise.resolve({ id: '1', isActive: false }),
    seed: () => Promise.resolve({ message: 'Success', count: 10 }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        {
          provide: ProductsService,
          useValue: mockProductsService,
        },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call findAll with proper params', async () => {
    const spy = jest.spyOn(service, 'findAll').mockResolvedValue([]);
    await controller.findAll(
      'store-1',
      'coffee',
      ProductCategory.FOOD_AND_BEVERAGE,
      'true',
    );
    expect(spy).toHaveBeenCalledWith(
      'store-1',
      'coffee',
      ProductCategory.FOOD_AND_BEVERAGE,
      true,
    );
  });

  it('should call seed', async () => {
    const spy = jest
      .spyOn(service, 'seed')
      .mockResolvedValue({ message: 'Success', count: 10, data: [] });
    await controller.seed('store-1');
    expect(spy).toHaveBeenCalledWith('store-1');
  });
});
