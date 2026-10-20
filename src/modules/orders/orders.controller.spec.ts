import { Test, type TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { OrderStatus } from '@prisma/client';

describe('OrdersController', () => {
  let controller: OrdersController;

  const mockOrdersService = {
    getOrders: jest.fn(),
    getOrderById: jest.fn(),
    createOrder: jest.fn(),
    updateOrderItems: jest.fn(),
    holdOrder: jest.fn(),
    getHeldOrders: jest.fn(),
    recallOrder: jest.fn(),
    cancelOrder: jest.fn(),
    refundOrder: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: mockOrdersService,
        },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
  });

  it('delegates getOrders to service with parsed params', async () => {
    mockOrdersService.getOrders.mockResolvedValue({ items: [], meta: {} });

    const result = await controller.getOrders(
      'store-1',
      OrderStatus.COMPLETED,
      'shift-1',
      '2026-10-01',
      '2026-10-19',
      '2',
      '15',
    );

    expect(result).toEqual({ items: [], meta: {} });
    expect(mockOrdersService.getOrders).toHaveBeenCalledWith({
      storeId: 'store-1',
      status: OrderStatus.COMPLETED,
      shiftId: 'shift-1',
      startDate: '2026-10-01',
      endDate: '2026-10-19',
      page: 2,
      limit: 15,
    });
  });

  it('delegates getOrderById to service', async () => {
    mockOrdersService.getOrderById.mockResolvedValue({ id: 'order-123' });

    const result = await controller.getOrderById('order-123');
    expect(result).toEqual({ id: 'order-123' });
    expect(mockOrdersService.getOrderById).toHaveBeenCalledWith('order-123');
  });
});
