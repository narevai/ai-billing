import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { buildMeterMetadata } from './to-meter-metadata.js';
import { BillingEventSchema } from '@ai-billing/testing';
import type { BillingEvent, Usage } from '../types/index.js';

describe('buildMeterMetadata with Strict Schema', () => {
  const StrictBillingEventSchema: z.ZodType<BillingEvent> = BillingEventSchema;
  const createMockEvent = (
    overrides: Partial<BillingEvent> = {},
  ): BillingEvent => {
    return StrictBillingEventSchema.parse({
      generationId: 'gen-123',
      modelId: 'gpt-4o',
      provider: 'openai',
      usage: {},
      tags: {},
      ...overrides,
    });
  };

  it('should map core fields and convert usage numbers to strings', () => {
    const event = createMockEvent({
      usage: {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      },
    });

    const result = buildMeterMetadata(event);

    expect(result).toMatchObject({
      generation_id: event.generationId,
      model_id: event.modelId,
      provider: event.provider,
      input_tokens: event.usage.inputTokens,
      output_tokens: event.usage.outputTokens,
      total_tokens: event.usage.totalTokens,
    });
  });

  it('should map specialized token fields and costs', () => {
    const event = createMockEvent({
      usage: {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        reasoningTokens: 100,
        cacheReadTokens: 200,
        cacheWriteTokens: 50,
        requestCount: 10,
        rawUpstreamInferenceCost: 0.0005,
        rawProviderCost: 0.0012,
      },
    });

    const result = buildMeterMetadata(event);

    expect(result.input_tokens).toBe(event.usage.inputTokens);
    expect(result.output_tokens).toBe(event.usage.outputTokens);
    expect(result.total_tokens).toBe(event.usage.totalTokens);
    expect(result.reasoning_tokens).toBe(event.usage.reasoningTokens);
    expect(result.cache_read_tokens).toBe(event.usage.cacheReadTokens);
    expect(result.cache_write_tokens).toBe(event.usage.cacheWriteTokens);
    expect(result.request_count).toBe(event.usage.requestCount);
    expect(result.raw_upstream_inference_cost).toBe(
      event.usage.rawUpstreamInferenceCost,
    );
    expect(result.raw_provider_cost).toBe(event.usage.rawProviderCost);
  });

  it('should handle complex tags with "tag_" prefix and stringification', () => {
    const event = createMockEvent({
      usage: {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      },
      tags: {
        env: 'prod',
        meta: { region: 'us-east-1' },
        priority: 1,
      },
    });

    const result = buildMeterMetadata(event);

    expect(result.tag_env).toBe('prod');
    expect(result.tag_meta).toBe('{"region":"us-east-1"}');
    expect(result.tag_priority).toBe(1);
  });

  it('should ignore malformed tags', () => {
    const malformedEvent = {
      generationId: 'gen-123',
      modelId: 'gpt-4o',
      provider: 'openai',
      usage: {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      },
      // tags: {}, explicitly malformed as undefined
    } as unknown as BillingEvent;

    const result = buildMeterMetadata(malformedEvent);

    expect(result.input_tokens).toBe(malformedEvent.usage.inputTokens);
    expect(result.output_tokens).toBe(malformedEvent.usage.outputTokens);
    expect(result.total_tokens).toBe(malformedEvent.usage.totalTokens);
    expect(result).not.toHaveProperty('tag_');
  });

  it('should ignore null or undefined values in usage and tags', () => {
    const event = createMockEvent({
      usage: {
        subProviderId: undefined,
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        reasoningTokens: undefined,
        cacheReadTokens: undefined,
        // rawProviderCost: 0.0012, explicitly ignored
      },
      tags: {
        valid: 'true',
        invalid: undefined,
      },
    });

    const result = buildMeterMetadata(event);

    expect(result.input_tokens).toBe(event.usage.inputTokens);
    expect(result.output_tokens).toBe(event.usage.outputTokens);
    expect(result.total_tokens).toBe(event.usage.totalTokens);
    expect(result).not.toHaveProperty('sub_provider_id');
    expect(result).not.toHaveProperty('tag_invalid');
    expect(result.tag_valid).toBe('true');
  });

  it('should correctly handle subProviderId when present', () => {
    const event = createMockEvent({
      usage: {
        subProviderId: 'azure-deployment-1',
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      },
    });

    const result = buildMeterMetadata(event);
    expect(result.sub_provider_id).toBe('azure-deployment-1');
  });
});
