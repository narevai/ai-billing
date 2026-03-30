import { Polar } from '@polar-sh/sdk';
// Adjust imports to pull from your core package
import { createDestination, costToNumber } from '@ai-billing/core';
import type { BillingEvent, Destination } from '@ai-billing/core';

function mapEventToPolarMetadata<TTags>(
  event: BillingEvent<TTags>,
): Record<string, string | number | boolean> {
  const metadata: Record<string, string | number | boolean> = {
    generation_id: event.generationId,
    model_id: event.modelId,
    provider: event.provider,
  };

  if (event.usage) {
    const usageFields: Record<string, keyof typeof event.usage> = {
      usage_input_tokens: 'inputTokens',
      usage_output_tokens: 'outputTokens',
      usage_total_tokens: 'totalTokens',
      usage_reasoning_tokens: 'reasoningTokens',
      usage_cache_read_tokens: 'cacheReadTokens',
      usage_cache_write_tokens: 'cacheWriteTokens',
      usage_request_count: 'requestCount',
      usage_raw_provider_cost: 'rawProviderCost',
    };

    for (const [polarKey, internalKey] of Object.entries(usageFields)) {
      const value = event.usage[internalKey];
      if (value !== undefined) {
        metadata[polarKey] = value;
      }
    }
  }

  if (event.cost) {
    metadata.cost_amount_base = costToNumber(event.cost, 'base');
    metadata.cost_amount_cents = costToNumber(event.cost, 'cents');
    metadata.cost_amount_micros = costToNumber(event.cost, 'micros');
    metadata.cost_amount_nanos = costToNumber(event.cost, 'nanos');
    metadata.cost_currency = event.cost.currency;
  }

  if (!event.tags) return metadata;

  for (const [key, value] of Object.entries(event.tags)) {
    if (value == null) continue; // Skip null/undefined immediately

    const metadataKey = `ai-billing-tag_${key}`;
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      metadata[metadataKey] = value;
    } else {
      // If it's an object/array, stringify it
      metadata[metadataKey] = JSON.stringify(value);
    }
  }

  return metadata;
}

export interface PolarDestinationOptions<TTags> {
  client?: Polar;
  accessToken?: string;
  server?: 'sandbox' | 'production';
  meterName: string | ((event: BillingEvent<TTags>) => string);

  /** * Custom key to look for in tags for Polar's internal customer ID (cus_...).
   * Defaults to: 'customerId' | 'polarCustomerId'
   */
  customerIdKey?: keyof TTags;

  /** * Custom key to look for in tags for your system's ID.
   * Defaults to: 'userId' | 'externalId'
   */
  externalCustomerIdKey?: keyof TTags;

  mapMetadata?: (
    event: BillingEvent<TTags>,
  ) => Record<string, string | number | boolean>;
}

export function createPolarDestination<TTags>(
  options: PolarDestinationOptions<TTags>,
): Destination<TTags> {
  const polar =
    options.client ??
    new Polar({
      accessToken: options.accessToken,
      server: options.server,
    });

  return createDestination<TTags>('polar', async event => {
    const tags = (event.tags ?? {}) as Record<
      string,
      string | number | boolean
    >;

    const internalId = tags[options.customerIdKey as string] ?? tags.customerId;
    const externalId =
      tags[options.externalCustomerIdKey as string] ?? tags.userId;

    if (!internalId && !externalId) {
      console.warn(
        '[ai-billing] Polar: No identity found in tags. Skipping event.',
      );
    }

    const meterName =
      typeof options.meterName === 'function'
        ? options.meterName(event)
        : options.meterName;

    const metadata = options.mapMetadata
      ? options.mapMetadata(event)
      : mapEventToPolarMetadata(event);

    await polar.events.ingest({
      events: [
        {
          name: meterName,
          // Priority: Internal Polar ID always wins if both are present
          ...(internalId
            ? { customerId: String(internalId) }
            : { externalCustomerId: String(externalId) }),
          metadata,
        },
      ],
    });
  });
}
