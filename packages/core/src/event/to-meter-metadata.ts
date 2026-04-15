import type {
  BillingEvent,
  DefaultTags,
  MeterMetadata,
} from '../types/index.js';

/**
 * Converts a billing event into a meter metadata object.
 * @param event - The billing event to convert.
 * @returns The meter metadata object.
 */
export function buildMeterMetadata<TTags extends DefaultTags = DefaultTags>(
  event: BillingEvent<TTags>,
): MeterMetadata {
  const u = event.usage ?? {};

  // Initialize with required fields
  const dimensions: MeterMetadata = {
    generation_id: event.generationId,
    model_id: event.modelId,
    provider: event.provider,
  };

  const addOptional = <K extends keyof MeterMetadata>(
    key: K,
    value: MeterMetadata[K],
  ) => {
    if (value !== undefined && value !== null) {
      dimensions[key] = value;
    }
  };

  addOptional('sub_provider', u.subProvider);
  addOptional('input_tokens', u.inputTokens);
  addOptional('output_tokens', u.outputTokens);
  addOptional('total_tokens', u.totalTokens);
  addOptional('reasoning_tokens', u.reasoningTokens);
  addOptional('cache_read_tokens', u.cacheReadTokens);
  addOptional('cache_write_tokens', u.cacheWriteTokens);
  addOptional('request_count', u.requestCount);
  addOptional('raw_provider_cost', u.rawProviderCost);
  addOptional('raw_upstream_inference_cost', u.rawUpstreamInferenceCost);

  if (event.tags) {
    for (const [key, value] of Object.entries(event.tags)) {
      if (value == null) continue;
      dimensions[`tag_${key}`] =
        typeof value === 'object'
          ? JSON.stringify(value)
          : (value as string | number);
    }
  }

  return dimensions;
}
