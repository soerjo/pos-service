import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request } from 'express';

@Injectable()
export class StoreIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
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

    const storeId: string | undefined =
      rawHeader?.trim() || queryStoreId || bodyStoreId;

    if (storeId) {
      request.storeId = storeId;
    }

    return next.handle();
  }
}
