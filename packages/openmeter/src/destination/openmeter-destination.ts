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

export interface OpenMeterDestinationOptions<
  TTags extends DefaultTags = DefaultTags,
> {
  /** OpenMeter API key. */
  apiKey: string;
  /** OpenMeter API base URL. Defaults to 'https://eu.api.konghq.com'. */
  apiUrl?: string;
  /** OpenMeter metering event type. Defaults to 'llm_usage'. */
  eventType?: string;

  /** Custom key to look for in tags for the OpenMeter customer ID.
   * Defaults to: 'userId' | 'openMeterCustomerId'
   */
  customerIdKey?: keyof TTags;

  mapMetadata?: (
    event: BillingEvent<TTags>,
  ) => Record<string, string | number | boolean>;
}

export function createOpenMeterDestination<
  TTags extends DefaultTags = DefaultTags,
>(options: OpenMeterDestinationOptions<TTags>): Destination<TTags> {
  const apiUrl = options.apiUrl ?? 'https://eu.api.konghq.com';
  const eventType = options.eventType ?? 'llm_usage';

  return createDestination<TTags>('openmeter', async event => {
    const tags = event.tags as Record<string, string | number | boolean>;

    const customerId =
      tags[options.customerIdKey as string] ??
      tags.openMeterCustomerId ??
      tags.userId;

    if (!customerId) {
      console.warn(
        '[ai-billing] OpenMeter: No customer_id found in tags. Skipping event.',
      );
      return;
    }

    const metadata: MeterMetadata | Record<string, string | number | boolean> =
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

    const payload = {
      specversion: '1.0',
      id: event.generationId,
      source: 'ai-billing',
      type: eventType,
      subject: String(customerId),
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      data: properties,
    };

    console.log('[ai-billing] Sending to OpenMeter:', {
      event_type: eventType,
      subject: String(customerId),
      transaction_id: event.generationId,
    });

    try {
      const response = await fetch(`${apiUrl}/v3/openmeter/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/cloudevents+json',
          Authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 429) {
        console.error(
          '[ai-billing] OpenMeterDestination Error: Rate limit exceeded.',
        );
      } else if (response.status === 422) {
        const body = await response.text();
        console.error(
          '[ai-billing] OpenMeterDestination Error: Invalid parameters supplied to OpenMeter API.',
          body,
        );
      } else if (response.status === 401) {
        console.error(
          '[ai-billing] OpenMeterDestination Error: Unauthorized. Check your API key.',
        );
      } else if (!response.ok) {
        const body = await response.text();
        console.error(
          `[ai-billing] OpenMeterDestination Error: Unexpected response (${response.status}).`,
          body,
        );
      }
    } catch (err: unknown) {
      if (err instanceof TypeError) {
        console.error(
          '[ai-billing] OpenMeterDestination Error: Network error.',
          (err as Error).message,
        );
      } else {
        console.error(
          '[ai-billing] OpenMeterDestination Error:',
          (err as Error).message,
        );
      }
    }
  });
}
