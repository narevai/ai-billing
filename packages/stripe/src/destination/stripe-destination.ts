import Stripe from 'stripe';
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

/**
 * Options for {@link createStripeDestination}.
 *
 * Stripe Meters ingest usage via `billing.meterEvents.create`, keyed by an event name plus a payload map.
 * This destination reads the Stripe customer identity from event tags, derives an `event_name`, and maps
 * billing metadata into a payload (with Stripe's payload size constraints in mind).
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 */
export interface StripeDestinationOptions<
  TTags extends DefaultTags = DefaultTags,
> {
  /**
   * Optional pre-configured Stripe SDK client. When omitted, a client is constructed from `apiKey`.
   */
  client?: Stripe;
  /**
   * Stripe secret key used when creating a Stripe SDK client (e.g. `sk_live_...`).
   *
   * Only used when `client` is not provided.
   */
  apiKey?: string;
  /**
   * Stripe meter event name (`event_name`), or a function that derives it from the billing event.
   */
  meterName: string | ((event: BillingEvent<TTags>) => string);
  /**
   * Optional override for the metadata included in the Stripe meter event payload.
   *
   * When omitted, metadata is built from {@link buildMeterMetadata}. This destination then:
   * - always includes `value` (cost in nanos; requires a defined {@link BillingEvent.cost} on each event)
   *   and `stripe_customer_id` (from tags; see {@link createStripeDestination} for missing-tag behavior)
   * - prioritizes a small set of commonly useful fields first
   * - hard-stops at 10 payload keys (Stripe constraint)
   */
  mapMetadata?: (event: BillingEvent<TTags>) => Record<string, string>;
}

/**
 * Creates a {@link Destination} that ingests billing events into Stripe Meters.
 *
 * **Identity:** Reads `stripe_customer_id` from {@link BillingEvent.tags}. When it is missing or falsy,
 * a warning is logged (`No identity found in tags. Skipping event.`), but execution continues: the
 * destination still builds the payload and calls Stripe. The payload field is set with
 * `String(identity)`, so a missing tag becomes the literal string `"undefined"`, not a skipped request.
 *
 * **Cost:** The meter payload always includes `value` from {@link BillingEvent.cost} via
 * {@link costToNumber}. The implementation uses non-null assertion on `event.cost`; callers should pass
 * a defined {@link BillingEvent.cost}. If `cost` is omitted, runtime behavior is undefined and may throw
 * when converting.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 * @param options - Destination configuration; see {@link StripeDestinationOptions}.
 * @returns A destination function that sends events to Stripe.
 */
export function createStripeDestination<
  TTags extends DefaultTags = DefaultTags,
>(options: StripeDestinationOptions<TTags>): Destination<TTags> {
  const stripe =
    options.client ??
    new Stripe(options.apiKey || '', {
      maxNetworkRetries: 3,
      timeout: 10000,
    });

  return createDestination<TTags>('stripe', async event => {
    const tags = (event.tags ?? {}) as Record<
      string,
      string | number | boolean
    >;

    const identityIdKey = 'stripe_customer_id';
    const identityIdValue = tags[identityIdKey as string];

    if (!identityIdValue) {
      console.warn(
        '[ai-billing] Stripe: No identity found in tags. Skipping event.',
      );
    }

    const meterName =
      typeof options.meterName === 'function'
        ? options.meterName(event)
        : options.meterName;

    const metadata: Record<string, string> | MeterMetadata = options.mapMetadata
      ? options.mapMetadata(event)
      : buildMeterMetadata(event);

    const payload: Record<string, string> = {
      value: costToNumber(event.cost!, 'nanos').toString(),
      [identityIdKey]: String(identityIdValue),
    };

    const priorityKeys: (keyof MeterMetadata)[] = [
      'model_id',
      'provider',
      'sub_provider',
      'input_tokens',
      'raw_provider_cost',
      'upstream_inference_cost',
    ];

    for (const key of priorityKeys) {
      if (metadata[key] !== undefined && metadata[key] !== null) {
        payload[key] = metadata[key].toString();
      }
    }

    for (const [key, val] of Object.entries(metadata)) {
      if (Object.keys(payload).length >= 10) break; // Hard stop at 10
      if (payload[key] !== undefined) continue; // Skip if already added

      if (val !== undefined && val !== null) {
        payload[key] = val.toString();
      }
    }

    try {
      await stripe.billing.meterEvents.create(
        {
          event_name: meterName,
          payload: payload,
          identifier: event.generationId,
        },
        {
          idempotencyKey: `${meterName}-${event.generationId}`,
        },
      );
    } catch (err: Stripe.errors.StripeError | unknown) {
      if (err instanceof stripe.errors.StripeError) {
        switch (err.type) {
          case 'StripeRateLimitError':
            // Too many requests made to the API too quickly
            console.error(
              '[ai-billling] StripeDestination Error: Rate limit exceeded. Message:',
              err.message,
              ' Request ID:',
              err.requestId,
            );
            break;
          case 'StripeInvalidRequestError':
            // Invalid parameters were supplied to Stripe's API
            console.error(
              '[ai-billling] StripeDestinationError',
              "Error: Invalid parameters were supplied to Stripe's API. Message:",
              err.message,
            );
            console.error('Request ID:', err.requestId);
            break;
          case 'StripeAPIError':
            // An error occurred internally with Stripe's API
            console.error(
              '[ai-billling] StripeDestinationError',
              "Error: An error occurred internally with Stripe's API. Message:",
              err.message,
              'Request ID:',
              err.requestId,
            );
            break;
          case 'StripeConnectionError':
            // Some kind of error occurred during the HTTPS communication
            console.error(
              '[ai-billling] StripeDestinationError',
              'Error: Some kind of error occurred during the HTTPS communication. Message:',
              err.message,
              'Request ID:',
              err.requestId,
            );
            break;
          case 'StripeAuthenticationError':
            // You probably used an incorrect API key
            console.error(
              '[ai-billling] StripeDestinationError',
              'Error: You probably used an incorrect API key. Message:',
              err.message,
              'Request ID:',
              err.requestId,
            );
            break;
          default:
            // All other Stripe errors
            console.error(
              '[ai-billling] StripeDestinationError',
              'Error: An unknown error occurred. Message:',
              err.message,
              'Request ID:',
              err.requestId,
            );
            break;
        }
      } else {
        console.error(
          '[ai-billling] StripeDestinationError',
          'Error:',
          (err as Error).message,
        );
      }
    }
  });
}
