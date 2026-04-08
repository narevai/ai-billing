import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPolarDestination } from './polar-destination.js';
import { Polar } from '@polar-sh/sdk';
import { costToNumber, type BillingEvent } from '@ai-billing/core';
import { BillingEventSchema } from '@ai-billing/testing';
import { z } from 'zod';

const mockIngest = vi.fn();

vi.mock('@polar-sh/sdk', () => {
  return {
    Polar: vi.fn().mockImplementation(function () {
      // 2. Use a standard function here so 'new' works
      return {
        events: {
          ingest: mockIngest.mockResolvedValue({ success: true }),
        },
      };
    }),
  };
});

describe('Polar Destination', () => {
  const StrictBillingEventSchema: z.ZodType<BillingEvent> = BillingEventSchema;
  let mockPolarInstance: Polar;

  const createMockEvent = (
    overrides: Partial<BillingEvent> = {},
  ): BillingEvent => {
    return StrictBillingEventSchema.parse({
      generationId: 'gen-123',
      modelId: 'gpt-4',
      provider: 'openai',
      tags: { customerId: 'cus_12345' },
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        reasoningTokens: 0,
        totalTokens: 150,
      },
      cost: { amount: 0.000004653, currency: 'USD', unit: 'base' },
      ...overrides,
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPolarInstance = new Polar({ accessToken: 'test' });
  });

  it('should ingest an event with correct metadata', async () => {
    const mockMeterName = 'meter_nanodollars';
    const mockEvent = createMockEvent();

    const destination = createPolarDestination({
      accessToken: 'test-token',
      meterName: mockMeterName,
    });

    await destination(mockEvent);

    const ingestSpy = new Polar().events.ingest;

    expect(ingestSpy).toHaveBeenCalledWith({
      events: [
        expect.objectContaining({
          name: mockMeterName,
          cost_nanos: costToNumber(mockEvent.cost!, 'nanos'),
          cost_currency: mockEvent.cost?.currency,
          customerId: mockEvent.tags?.customerId,
          metadata: expect.objectContaining({
            generation_id: mockEvent.generationId,
            model_id: mockEvent.modelId,
            provider: mockEvent.provider,
            input_tokens: mockEvent.usage?.inputTokens,
            output_tokens: mockEvent.usage?.outputTokens,
            cache_read_tokens: mockEvent.usage?.cacheReadTokens,
            cache_write_tokens: mockEvent.usage?.cacheWriteTokens,
            reasoning_tokens: mockEvent.usage?.reasoningTokens,
            total_tokens: mockEvent.usage?.totalTokens,
            tag_customerId: mockEvent.tags?.customerId,
          }),
        }),
      ],
    });
  });

  it('should ingest an event with correct customerId', async () => {
    const mockMeterName = 'meter_nanocents';
    const mockEvent = createMockEvent();

    const destination = createPolarDestination({
      accessToken: 'test-token',
      meterName: mockMeterName,
    });

    await destination(mockEvent);

    const ingestSpy = new Polar().events.ingest;

    expect(ingestSpy).toHaveBeenCalledWith({
      events: [
        expect.objectContaining({
          name: mockMeterName,
          customerId: mockEvent.tags.customerId,
        }),
      ],
    });
  });

  it('should ingest an event with correct userId', async () => {
    const mockMeterName = 'meter_nanocents';
    const mockEvent = createMockEvent({
      tags: { userId: 'user_67890' },
    });

    const destination = createPolarDestination({
      accessToken: 'test-token',
      meterName: mockMeterName,
    });

    await destination(mockEvent);

    const ingestSpy = new Polar().events.ingest;

    expect(ingestSpy).toHaveBeenCalledWith({
      events: [
        expect.objectContaining({
          name: mockMeterName,
          externalCustomerId: mockEvent.tags.userId,
        }),
      ],
    });
  });

  it('should prioritize internal customerId over external userId', async () => {
    const mockUserId = 'user_67890';
    const mockCustomerId = 'cus_12345';
    const mockEvent = createMockEvent({
      tags: {
        customerId: mockCustomerId,
        userId: mockUserId,
      },
    });

    const destination = createPolarDestination({
      accessToken: 'test',
      meterName: 'test_meter',
    });

    await destination(mockEvent);

    const ingestSpy = new Polar().events.ingest;
    expect(ingestSpy).toHaveBeenCalledWith({
      events: [
        expect.objectContaining({
          customerId: mockCustomerId,
        }),
      ],
    });
    expect(ingestSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ externalCustomerId: mockUserId }),
    );
  });

  it('should resolve meter name using a function', async () => {
    const mockEvent = createMockEvent({ modelId: 'claude-3' });
    const destination = createPolarDestination({
      accessToken: 'test',
      meterName: event => `meter_${event.modelId}`,
    });

    await destination(mockEvent);

    const ingestSpy = new Polar().events.ingest;
    expect(ingestSpy).toHaveBeenCalledWith({
      events: [expect.objectContaining({ name: `meter_${mockEvent.modelId}` })],
    });
  });

  it('should map custom tags with prefixes and stringify objects', async () => {
    const mockEvent = createMockEvent({
      tags: {
        customerId: '123',
        environment: 'production',
        meta: { feature: 'chat' }, // Nested object
      },
    });

    const destination = createPolarDestination({
      accessToken: 'test',
      meterName: 'test',
    });

    await destination(mockEvent);

    const ingestSpy = vi.mocked(new Polar().events.ingest);

    expect(ingestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        events: [
          expect.objectContaining({
            metadata: expect.objectContaining({
              tag_environment: 'production',
              tag_meta: '{"feature":"chat"}',
            }),
          }),
        ],
      }),
    );
  });

  it('should warn and skip identity if no customerId or userId is found', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const destination = createPolarDestination({
      accessToken: 'test-token',
      meterName: 'test-meter',
    });

    const mockEvent = createMockEvent({ tags: {} });

    await destination(mockEvent);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('No identity found in tags'),
    );

    consoleSpy.mockRestore();
  });

  it('should handle events cost data', async () => {
    const destination = createPolarDestination({
      accessToken: 'test-token',
      meterName: 'test-meter',
    });

    const malformedEvent = createMockEvent({
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
      cost: undefined,
    });

    await destination(malformedEvent);

    expect(mockIngest).toHaveBeenCalled();

    const callArgs = mockIngest.mock?.calls?.[0]?.[0];
    expect(callArgs.events[0].metadata).not.toHaveProperty('cost_amount_base');
  });

  it('should gracefully handle raw JavaScript objects missing strictly required usage', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const destination = createPolarDestination({
      accessToken: 'test-token',
      meterName: 'test-meter',
    });
    const rawMalformedEvent = {
      generationId: 'gen-raw',
      modelId: 'raw-model',
      provider: 'raw-provider',
      tags: {},
    } as unknown as BillingEvent;

    await destination(rawMalformedEvent);

    const ingestSpy = vi.mocked(new Polar().events.ingest);
    const callArgs = ingestSpy.mock.calls[0]![0];
    const metadata = callArgs.events[0]!.metadata;

    // Verify it mapped the base fields safely
    expect(metadata).toEqual({
      generation_id: 'gen-raw',
      model_id: 'raw-model',
      provider: 'raw-provider',
    });

    const keys = Object.keys(metadata ?? {});
    expect(keys.some(k => k.startsWith('input_tokens'))).toBe(false);
    expect(keys.some(k => k.startsWith('output_tokens'))).toBe(false);
    expect(keys.some(k => k.startsWith('total_tokens'))).toBe(false);
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });

  it('should return metadata immediately if event.tags is undefined', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const destination = createPolarDestination({
      accessToken: 'test',
      meterName: 'test',
    });

    // Explicitly set tags to undefined (bypassing the helper default)
    let malformedEvent = {
      generationId: 'gen-123',
      modelId: 'gpt-4',
      provider: 'openai',
      //tags: {}, // no tags
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      cost: { amount: 0.000004653, currency: 'USD', unit: 'base' },
    } as BillingEvent;

    await destination(malformedEvent);

    const ingestSpy = vi.mocked(new Polar().events.ingest);
    const metadata = ingestSpy.mock!.calls![0]![0]!.events[0]!.metadata;

    // Should still have base metadata but no ai-billing-tag keys
    expect(metadata).toHaveProperty('generation_id');
    expect(metadata).toHaveProperty('model_id');
    expect(metadata).toHaveProperty('provider');
    expect(metadata).toHaveProperty('input_tokens');
    expect(metadata).toHaveProperty('output_tokens');
    expect(metadata).toHaveProperty('total_tokens');

    const tagKeys = Object.keys(metadata ?? {}).filter(k =>
      k.startsWith('tag_'),
    );

    expect(tagKeys.length).toBe(0);
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });

  it('should handle all tag value types: null, boolean, number, and arrays', async () => {
    const mockEvent = createMockEvent({
      tags: {
        customerId: 'cus_123',
        is_valid: true, // Boolean branch
        priority: 1, // Number branch
        ignored: null, // Null/Undefined branch (the continue)
        list: [1, 2, 3], // Object/Array branch (JSON.stringify)
      },
    });

    const destination = createPolarDestination({
      accessToken: 'test',
      meterName: 'test',
    });

    await destination(mockEvent);

    const ingestSpy = vi.mocked(new Polar().events.ingest);
    const metadata = ingestSpy.mock!.calls![0]![0]!.events[0]!.metadata;

    expect(metadata).toBeDefined();
    expect((metadata ?? {})['tag_is_valid']).toBe(true);
    expect((metadata ?? {})['tag_priority']).toBe(1);
    expect((metadata ?? {})['tag_list']).toBe('[1,2,3]');
    expect(metadata ?? {}).not.toHaveProperty('tag_ignored');
  });

  it('should use a custom mapMetadata function when provided in options', async () => {
    const mockEvent = createMockEvent();
    const customMetadata = {
      my_custom_override: 'active',
      original_id: '123',
    };

    // mock mapMetadata function
    const mapMetadataSpy = vi.fn().mockReturnValue(customMetadata);

    const destination = createPolarDestination({
      accessToken: 'test-token',
      meterName: 'test-meter',
      mapMetadata: mapMetadataSpy,
    });

    await destination(mockEvent);

    expect(mapMetadataSpy).toHaveBeenCalledWith(mockEvent);
    const ingestSpy = vi.mocked(new Polar().events.ingest);
    const sentMetadata = ingestSpy.mock!.calls![0]![0]!.events[0]!.metadata;
    expect(sentMetadata).toEqual(customMetadata);
    expect(sentMetadata).not.toHaveProperty('generation_id');
  });
});
