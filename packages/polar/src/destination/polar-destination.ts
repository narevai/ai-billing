import { Polar } from '@polar-sh/sdk';
import {
  createDestination,
  costToNumber,
  buildMeterMetadata,
} from '@ai-billing/core';
import type { BillingEvent, DefaultTags, Destination } from '@ai-billing/core';

export interface PolarDestinationOptions<
  TTags extends DefaultTags = DefaultTags,
> {
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
      : (buildMeterMetadata(event) as Record<
          string,
          string | number | boolean
        >);

    await polar.events.ingest({
      events: [
        {
          name: meterName,
          ...(internalId
            ? { customerId: String(internalId) }
            : { externalCustomerId: String(externalId) }),
          ...(event.cost
            ? {
                cost_nanos: costToNumber(event.cost, 'nanos'),
                cost_currency: event.cost.currency,
              }
            : {}),
          metadata,
        },
      ],
    });
  });
}
