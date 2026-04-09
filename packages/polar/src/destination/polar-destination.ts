import { Polar } from '@polar-sh/sdk';
import {
  createDestination,
  costToNumber,
  buildMeterMetadata,
} from '@ai-billing/core';
import type { BillingEvent, DefaultTags, Destination } from '@ai-billing/core';
import { EventMetadataInput } from '@polar-sh/sdk/models/components/eventmetadatainput.js';

export interface PolarDestinationOptions<
  TTags extends DefaultTags = DefaultTags,
> {
  client?: Polar;
  accessToken?: string;
  server?: 'sandbox' | 'production';
  eventName: string | ((event: BillingEvent<TTags>) => string);
  customerIdKey?: keyof TTags;
  externalCustomerIdKey?: keyof TTags;

  mapMetadata?: (
    event: BillingEvent<TTags>,
  ) => Record<string, string | number | boolean>;
}

export function createPolarDestination<TTags extends DefaultTags = DefaultTags>(
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

    const internalId = options.customerIdKey
      ? tags[options.customerIdKey as string]
      : (tags.customerId ?? tags.polarCustomerId ?? tags.customer_id);

    const externalId = options.externalCustomerIdKey
      ? tags[options.externalCustomerIdKey as string]
      : (tags.userId ?? tags.externalId ?? tags.user_id);

    if (!internalId && !externalId) {
      console.warn(
        '[ai-billing] Polar: No identity found in tags. Skipping event.',
      );
    }

    const eventName =
      typeof options.eventName === 'function'
        ? options.eventName(event)
        : options.eventName;

    let metadata: Record<string, EventMetadataInput>;

    if (options.mapMetadata) {
      metadata = options.mapMetadata(event);
    } else {
      metadata = {
        ...(buildMeterMetadata(event) as Record<
          string,
          string | number | boolean
        >),
        ...(event.cost
          ? {
              cost_nanos: costToNumber(event.cost, 'nanos'),
              cost_currency: event.cost.currency,
            }
          : {}),
      };
    }

    try {
      await polar.events.ingest({
        events: [
          {
            name: eventName,
            customerId: String(internalId),
            ...(externalId ? { externalId: String(externalId) } : {}),
            metadata,
          },
        ],
      });
    } catch (error) {
      console.error('[ai-billing] Failed to ingest event to Polar:', error);
    }
  });
}
