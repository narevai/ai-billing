import {
  createDestination,
  costToNumber,
  buildMeterMetadata,
} from '@ai-billing/core';
import type {
  BillingEvent,
  DefaultTags,
  Destination,
  MeterMetadata,
} from '@ai-billing/core';

export interface LagoDestinationOptions<
  TTags extends DefaultTags = DefaultTags,
> {
  apiKey: string;
  apiUrl?: string;
  /** Lago billable metric code. Defaults to 'llm_usage'. */
  meterCode?: string | ((event: BillingEvent<TTags>) => string);

  /** Custom key to look for in tags for the Lago external customer ID.
   * Defaults to: 'userId' | 'externalCustomerId'
   */
  externalCustomerIdKey?: keyof TTags;

  mapMetadata?: (
    event: BillingEvent<TTags>,
  ) => Record<string, string | number | boolean>;
}

export function createLagoDestination<TTags extends DefaultTags = DefaultTags>(
  options: LagoDestinationOptions<TTags>,
): Destination<TTags> {
  const apiUrl = options.apiUrl ?? 'https://api.getlago.com';

  return createDestination<TTags>('lago', async event => {
    const tags = event.tags as Record<string, string | number | boolean>;

    const externalCustomerId =
      tags[options.externalCustomerIdKey as string] ??
      tags.userId ??
      tags.externalCustomerId;

    if (!externalCustomerId) {
      console.warn(
        '[ai-billing] Lago: No external_customer_id found in tags. Skipping event.',
      );
      return;
    }

    const meterCode =
      typeof options.meterCode === 'function'
        ? options.meterCode(event)
        : (options.meterCode ?? 'llm_usage');

    const metadata: Record<string, string | number | boolean> | MeterMetadata =
      options.mapMetadata
        ? options.mapMetadata(event)
        : buildMeterMetadata(event);

    const properties: Record<string, string | number | boolean> = {
      cost_nanos: costToNumber(event.cost!, 'nanos'),
      currency: event.cost!.currency,
    };

    for (const [key, value] of Object.entries(metadata)) {
      if (value !== undefined) {
        properties[key] = value as string | number | boolean;
      }
    }

    console.log('[ai-billing] Sending to Lago:', {
      meter_code: meterCode,
      properties,
      transaction_id: event.generationId,
    });

    try {
      const response = await fetch(`${apiUrl}/api/v1/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify({
          event: {
            transaction_id: event.generationId,
            external_customer_id: String(externalCustomerId),
            code: meterCode,
            timestamp: Math.floor(Date.now() / 1000),
            properties,
          },
        }),
      });

      if (response.status === 429) {
        console.error(
          '[ai-billing] LagoDestination Error: Rate limit exceeded.',
        );
      } else if (response.status === 422) {
        const body = await response.text();
        console.error(
          '[ai-billing] LagoDestination Error: Invalid parameters supplied to Lago API.',
          body,
        );
      } else if (response.status === 401) {
        console.error(
          '[ai-billing] LagoDestination Error: Unauthorized. Check your API key.',
        );
      } else if (!response.ok) {
        const body = await response.text();
        console.error(
          `[ai-billing] LagoDestination Error: Unexpected response (${response.status}).`,
          body,
        );
      }
    } catch (err: unknown) {
      if (err instanceof TypeError) {
        console.error(
          '[ai-billing] LagoDestination Error: Network error.',
          (err as Error).message,
        );
      } else {
        console.error(
          '[ai-billing] LagoDestination Error:',
          (err as Error).message,
        );
      }
    }
  });
}
