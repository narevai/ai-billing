import { Polar } from '@polar-sh/sdk';
import {
  createDestination,
  costToNumber,
  buildMeterMetadata,
} from '@ai-billing/core';
import type { BillingEvent, DefaultTags, Destination } from '@ai-billing/core';
import { EventMetadataInput } from '@polar-sh/sdk/models/components/eventmetadatainput.js';

/**
 * Options for {@link createPolarDestination}.
 *
 * Polar ingests events keyed by a `customerId` (and optionally an `externalId`) plus a metadata map. This
 * destination extracts identity from billing event tags, builds default metadata from the event (usage +
 * tags), and includes cost when present.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 */
export interface PolarDestinationOptions<
  TTags extends DefaultTags = DefaultTags,
> {
  /**
   * Optional pre-configured Polar SDK client. When omitted, a client is constructed from `accessToken` and
   * `server`.
   */
  client?: Polar;
  /** Access token used when creating a Polar SDK client. */
  accessToken?: string;
  /** Polar environment used when creating a Polar SDK client. */
  server?: 'sandbox' | 'production';
  /**
   * Event name to ingest into Polar, or a function that derives the name from the billing event.
   *
   * Use a function when you want different Polar events per model/provider while keeping one destination.
   */
  eventName: string | ((event: BillingEvent<TTags>) => string);
  /**
   * Tag key used to read the Polar `customerId` (internal ID). When omitted, common tag keys are checked:
   * `customerId`, `polarCustomerId`, `customer_id`.
   */
  customerIdKey?: keyof TTags;
  /**
   * Tag key used to read the Polar `externalId`. When omitted, common tag keys are checked: `userId`,
   * `externalId`, `user_id`.
   */
  externalCustomerIdKey?: keyof TTags;

  /**
   * Optional override for the metadata payload sent to Polar.
   *
   * When omitted, metadata is built from {@link buildMeterMetadata} and includes:
   * - token/usage dimensions
   * - `tag_*` values from event tags
   * - `cost_nanos` / `cost_currency` when `event.cost` is present
   */
  mapMetadata?: (
    event: BillingEvent<TTags>,
  ) => Record<string, string | number | boolean>;
}

/**
 * Creates a {@link Destination} that ingests billing events into Polar.
 *
 * Identity is extracted from tags (internal `customerId`, plus optional `externalId`). If neither identity
 * is present, the event is skipped to avoid ingesting anonymous data.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 * @param options - Destination configuration; see {@link PolarDestinationOptions}.
 * @returns A destination function that sends events to Polar.
 */
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
