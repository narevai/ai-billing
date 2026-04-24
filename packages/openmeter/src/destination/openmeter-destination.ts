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
 * Options for {@link createOpenMeterDestination}.
 *
 * OpenMeter ingests usage as CloudEvents where the event `type` identifies the meter and the `subject`
 * identifies the customer. This destination extracts identity from billing event tags, builds default
 * `data` from the event (usage + tags), and always sets `cost_nanos` and `currency` from
 * {@link BillingEvent.cost}. Callers must supply a defined `cost` on each event; the implementation
 * asserts it is present and may throw at runtime if it is omitted.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 */
export interface OpenMeterDestinationOptions<
  TTags extends DefaultTags = DefaultTags,
> {
  /** OpenMeter API key. */
  apiKey: string;
  /** OpenMeter API base URL. Defaults to 'https://eu.api.konghq.com'. */
  apiUrl?: string;
  /**
   * OpenMeter metering event type (CloudEvents `type`).
   *
   * Defaults to `'llm_usage'`.
   */
  eventType?: string;

  /**
   * Tag key used to read the OpenMeter customer identifier (CloudEvents `subject`). When omitted, common
   * tag keys are checked: `openMeterCustomerId`, `userId`.
   */
  customerIdKey?: keyof TTags;

  /**
   * Optional override for the `data` payload sent to OpenMeter.
   *
   * When omitted, metadata is built from {@link buildMeterMetadata} and includes:
   * - token/usage dimensions
   * - `tag_*` values from event tags
   *
   * Note: this destination always merges `cost_nanos` and `currency` into `data` from `event.cost` via
   * non-null assertion. Missing {@link BillingEvent.cost} is not supported and will throw when converting.
   */
  mapMetadata?: (
    event: BillingEvent<TTags>,
  ) => Record<string, string | number | boolean>;
}

/**
 * Creates a {@link Destination} that ingests billing events into OpenMeter.
 *
 * Identity is extracted from tags (CloudEvents `subject`). If no identity is present, the event is
 * skipped to avoid ingesting anonymous data.
 *
 * **Cost:** Each event must include {@link BillingEvent.cost}. The payload always includes `cost_nanos`
 * and `currency` derived from `event.cost` using non-null assertion; omitting `cost` causes undefined
 * runtime behavior (typically a throw in {@link costToNumber} or when reading `currency`).
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 * @param options - Destination configuration; see {@link OpenMeterDestinationOptions}.
 * @returns A destination function that sends events to OpenMeter.
 */
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
