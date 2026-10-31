import {
  createParamDecorator,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';

export interface StoreIdDecoratorOptions {
  required?: boolean;
}

export const StoreId = createParamDecorator(
  (
    options: StoreIdDecoratorOptions | boolean | undefined,
    ctx: ExecutionContext,
  ): string | undefined => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { storeId?: string }>();
    const headerVal = request.headers['x-store-id'];
    const rawHeader = Array.isArray(headerVal)
      ? headerVal[0]
      : typeof headerVal === 'string'
        ? headerVal
        : undefined;

    const body =
      typeof request.body === 'object' && request.body !== null
        ? (request.body as Record<string, unknown>)
        : undefined;
    const bodyStoreId =
      typeof body?.['storeId'] === 'string'
        ? body['storeId'].trim()
        : undefined;

    const queryStoreId =
      typeof request.query?.['storeId'] === 'string'
        ? request.query['storeId'].trim()
        : undefined;

    const reqStoreId =
      typeof request.storeId === 'string' ? request.storeId.trim() : undefined;

    const storeId: string | undefined =
      rawHeader?.trim() || reqStoreId || queryStoreId || bodyStoreId;

    const isRequired =
      typeof options === 'boolean' ? options : (options?.required ?? false);

    if (isRequired && !storeId) {
      throw new BadRequestException(
        'storeId is required (via x-store-id header, query parameter, or body)',
      );
    }

    return storeId;
  },
);

export const CurrentStoreId = StoreId;
