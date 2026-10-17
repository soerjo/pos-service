import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod } from '@prisma/client';

@Injectable()
export class MidtransService {
  constructor(private readonly configService: ConfigService) {}

  async charge(
    orderNumber: string,
    grossAmount: number | string,
    method: PaymentMethod,
  ): Promise<any> {
    const serverKey = this.configService.get<string>('MIDTRANS_SERVER_KEY');
    const isProduction =
      this.configService.get<boolean>('MIDTRANS_IS_PRODUCTION') ?? false;

    const baseUrl = isProduction
      ? 'https://app.midtrans.com/snap/v1/transactions'
      : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

    let enabledPayments: string[] = [];
    if (method === PaymentMethod.MIDTRANS_QRIS) {
      enabledPayments = ['other_qris'];
    } else if (method === PaymentMethod.MIDTRANS_GOPAY) {
      enabledPayments = ['gopay'];
    } else if (method === PaymentMethod.MIDTRANS_VA) {
      enabledPayments = ['bank_transfer'];
    }

    const payload = {
      transaction_details: {
        order_id: `${orderNumber}-${Date.now()}`,
        gross_amount: Number(grossAmount),
      },
      enabled_payments: enabledPayments,
    };

    const authHeader = `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new ServiceUnavailableException(
          `Midtrans charge failed: ${response.status} ${errorText}`,
        );
      }

      return await response.json();
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      const errMessage = error instanceof Error ? error.message : String(error);
      throw new ServiceUnavailableException(
        `Midtrans service unavailable: ${errMessage}`,
      );
    }
  }
}
