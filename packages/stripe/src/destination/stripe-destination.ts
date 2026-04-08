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

export interface StripeDestinationOptions<
  TTags extends DefaultTags = DefaultTags,
> {
  client?: Stripe;
  apiKey?: string;
  meterName: string | ((event: BillingEvent<TTags>) => string);
  mapMetadata?: (event: BillingEvent<TTags>) => Record<string, string>;
}

export function createStripeDestination<
  TTags extends DefaultTags = DefaultTags,
>(options: StripeDestinationOptions<TTags>): Destination<TTags> {
  const stripe =
    options.client ??
    new Stripe(options.apiKey || '', {
      maxNetworkRetries: 3, // Automatically retries on 409 (Idempotency) or 5xx errors
      timeout: 10000, // 10 second timeout
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
      'sub_provider_id',
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

    console.log('[ai-billing] Sending to Stripe:', {
      event_name: meterName,
      payload,
      identifier: event.generationId,
    });

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
              '[ai-billling] StripeDestination Error: Rate limit exceeded. Request ID:',
              err.requestId,
            );
            break;
          case 'StripeInvalidRequestError':
            // Invalid parameters were supplied to Stripe's API
            console.error(
              '[ai-billling] StripeDestinationError',
              "Error: Invalid parameters were supplied to Stripe's API.Message:",
              err.message,
            );
            if (err.param) console.error('Param:', err.param);
            console.error('Request ID:', err.requestId);
            break;
          case 'StripeAPIError':
            // An error occurred internally with Stripe's API
            console.error(
              '[ai-billling] StripeDestinationError',
              "Error: An error occurred internally with Stripe's API.Message:",
              err.message,
              'Request ID:',
              err.requestId,
            );
            break;
          case 'StripeConnectionError':
            // Some kind of error occurred during the HTTPS communication
            console.error(
              '[ai-billling] StripeDestinationError',
              'Error: Some kind of error occurred during the HTTPS communication.Message:',
              err.message,
              'Request ID:',
              err.requestId,
            );
            break;
          case 'StripeAuthenticationError':
            // You probably used an incorrect API key
            console.error(
              '[ai-billling] StripeDestinationError',
              'Error: You probably used an incorrect API key.Message:',
              err.message,
              'Request ID:',
              err.requestId,
            );
            break;
          default:
            // All other Stripe errors
            console.error(
              '[ai-billling] StripeDestinationError',
              'Error: An unknown error occurred.Message:',
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
