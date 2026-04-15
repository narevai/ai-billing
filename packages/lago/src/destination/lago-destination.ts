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
 * Options for {@link createLagoDestination}.
 *
 * Lago ingests metered usage as events tied to an `external_customer_id` plus a `code` (billable metric
 * code). This destination extracts identity from billing event tags, builds default `properties` from the
 * event (usage + tags), and always sets `cost_nanos` and `currency` from {@link BillingEvent.cost}. Callers
 * must supply a defined `cost` on each event; the implementation asserts it is present and may throw at
 * runtime if it is omitted.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 */
export interface LagoDestinationOptions<
  TTags extends DefaultTags = DefaultTags,
> {
  /** Lago API key used for `Authorization: Bearer ...`. */
  apiKey: string;
  /** Base URL for the Lago API. Defaults to `https://api.getlago.com`. */
  apiUrl?: string;
  /**
   * Lago billable metric code (`event.code`), or a function that derives the code from the billing event.
   *
   * Defaults to `'llm_usage'`.
   */
  meterCode?: string | ((event: BillingEvent<TTags>) => string);

  /**
   * Tag key used to read the Lago `external_customer_id`. When omitted, common tag keys are checked:
   * `userId`, `externalCustomerId`.
   */
  externalCustomerIdKey?: keyof TTags;

  /**
   * Optional override for the `properties` payload sent to Lago.
   *
   * When omitted, metadata is built from {@link buildMeterMetadata} and includes:
   * - token/usage dimensions
   * - `tag_*` values from event tags
   *
   * Note: this destination always merges `cost_nanos` and `currency` into `properties` from `event.cost` via
   * non-null assertion. Missing {@link BillingEvent.cost} is not supported and will throw when converting.
   */
  mapMetadata?: (
    event: BillingEvent<TTags>,
  ) => Record<string, string | number | boolean>;
}

/**
 * Creates a {@link Destination} that ingests billing events into Lago.
 *
 * Identity is extracted from tags (Lago `external_customer_id`). If no identity is present, the event is
 * skipped to avoid ingesting anonymous data.
 *
 * **Cost:** Each event must include {@link BillingEvent.cost}. The payload always includes `cost_nanos`
 * and `currency` derived from `event.cost` using non-null assertion; omitting `cost` causes undefined
 * runtime behavior (typically a throw in {@link costToNumber} or when reading `currency`).
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 * @param options - Destination configuration; see {@link LagoDestinationOptions}.
 * @returns A destination function that sends events to Lago.
 */
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
