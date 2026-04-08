import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStripeDestination } from './stripe-destination.js'; // Adjust path if necessary
import Stripe from 'stripe';
import { costToNumber, BillingEvent } from '@ai-billing/core';
import { BillingEventSchema } from '@ai-billing/testing';
import { z } from 'zod';

const mockCreateMeterEvent = vi.fn();

class MockStripeError extends Error {
  type: string;
  requestId?: string;
  param?: string;
  constructor(
    message: string,
    type: string,
    requestId?: string,
    param?: string,
  ) {
    super(message);
    this.name = 'StripeError';
    this.type = type;
    this.requestId = requestId;
    this.param = param;
  }
}

vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return {
        billing: {
          meterEvents: {
            create: mockCreateMeterEvent,
          },
        },
        errors: {
          StripeError: MockStripeError,
        },
      };
    }),
  };
});

describe('Stripe Destination', () => {
  const StrictBillingEventSchema: z.ZodType<BillingEvent> = BillingEventSchema;

  const createMockEvent = (
    overrides: Partial<BillingEvent> = {},
  ): BillingEvent => {
    return StrictBillingEventSchema.parse({
      generationId: 'gen-123',
      modelId: 'gpt-4',
      provider: 'openai',
      tags: { stripe_customer_id: 'cus_stripe123' },
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 0,
        reasoningTokens: 0,
        totalTokens: 150,
      },
      cost: { amount: 0.000004653, currency: 'USD', unit: 'base' },
      ...overrides,
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send a meter event to Stripe with correct payload and idempotency key', async () => {
    const mockMeterName = 'meter_nanocents';
    const mockEvent = createMockEvent();

    const destination = createStripeDestination({
      apiKey: 'test-key',
      meterName: mockMeterName,
    });

    await destination(mockEvent);

    expect(mockCreateMeterEvent).toHaveBeenCalledTimes(1);
    expect(mockCreateMeterEvent).toHaveBeenCalledWith(
      {
        event_name: mockMeterName,
        identifier: mockEvent.generationId,
        payload: expect.objectContaining({
          value: costToNumber(mockEvent.cost!, 'nanos').toString(),
          stripe_customer_id: 'cus_stripe123',
          model_id: mockEvent.modelId,
          provider: mockEvent.provider,
        }),
      },
      {
        idempotencyKey: `${mockMeterName}-${mockEvent.generationId}`,
      },
    );
  });

  it('should warn and skip identity if no stripe_customer_id is found in tags', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const destination = createStripeDestination({
      apiKey: 'test-key',
      meterName: 'test-meter',
    });

    // Event missing the stripe_customer_id
    const mockEvent = createMockEvent({ tags: { some_other_id: '123' } });

    await destination(mockEvent);

    expect(consoleSpy).toHaveBeenCalledWith(
      '[ai-billing] Stripe: No identity found in tags. Skipping event.',
    );

    // Payload should still be sent, but without stripe_customer_id
    expect(mockCreateMeterEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
    );
    const callArgs = mockCreateMeterEvent.mock.calls[0]![0];
    expect(callArgs.payload.stripe_customer_id).toBe('undefined');

    consoleSpy.mockRestore();
  });

  it('should resolve meter name using a function', async () => {
    const mockEvent = createMockEvent({ modelId: 'claude-3' });
    const destination = createStripeDestination({
      apiKey: 'test',
      meterName: event => `meter_${event.modelId}`,
    });

    await destination(mockEvent);

    expect(mockCreateMeterEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event_name: `meter_${mockEvent.modelId}` }),
      expect.anything(),
    );
  });

  it('should limit payload strictly to 10 keys and prioritize specific fields', async () => {
    const mockEvent = createMockEvent();

    const destination = createStripeDestination({
      apiKey: 'test-key',
      meterName: 'test-meter',
      // Provide way more than 10 keys
      mapMetadata: () => ({
        model_id: 'gpt-4', // Priority
        provider: 'openai', // Priority
        input_tokens: '100', // Priority
        extra_1: '1',
        extra_2: '2',
        extra_3: '3',
        extra_4: '4',
        extra_5: '5',
        extra_6: '6',
        extra_7: '7',
        extra_8: '8',
        extra_9: '9',
      }),
    });

    await destination(mockEvent);

    const callArgs = mockCreateMeterEvent.mock.calls[0]![0];
    const payloadKeys = Object.keys(callArgs.payload);

    expect(payloadKeys.length).toBeLessThanOrEqual(10);

    // Ensure priority keys made it in despite the flood of extra keys
    expect(payloadKeys).toContain('value');
    expect(payloadKeys).toContain('stripe_customer_id');
    expect(payloadKeys).toContain('model_id');
    expect(payloadKeys).toContain('provider');
    expect(payloadKeys).toContain('input_tokens');
  });

  it('should handle StripeRateLimitError appropriately', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockCreateMeterEvent.mockRejectedValueOnce(
      new MockStripeError(
        'Too many requests',
        'StripeRateLimitError',
        'req_123',
      ),
    );

    const destination = createStripeDestination({
      apiKey: 'test-key',
      meterName: 'test-meter',
    });

    await destination(createMockEvent());

    expect(consoleSpy).toHaveBeenCalledWith(
      '[ai-billling] StripeDestination Error: Rate limit exceeded. Message:',
      'Too many requests',
      ' Request ID:',
      'req_123',
    );
    consoleSpy.mockRestore();
  });

  it('should handle StripeInvalidRequestError appropriately', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockCreateMeterEvent.mockRejectedValueOnce(
      new MockStripeError(
        'Invalid param',
        'StripeInvalidRequestError',
        'req_456',
        'bad_param',
      ),
    );

    const destination = createStripeDestination({
      apiKey: 'test-key',
      meterName: 'test-meter',
    });

    await destination(createMockEvent());

    expect(consoleSpy).toHaveBeenCalledWith(
      '[ai-billling] StripeDestinationError',
      "Error: Invalid parameters were supplied to Stripe's API. Message:",
      'Invalid param',
    );
    consoleSpy.mockRestore();
  });

  it('should handle StripeAPIError appropriately', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockCreateMeterEvent.mockRejectedValueOnce(
      new MockStripeError(
        'Internal Stripe API error',
        'StripeAPIError',
        'req_api_123',
      ),
    );

    const destination = createStripeDestination({
      apiKey: 'test-key',
      meterName: 'test-meter',
    });

    await destination(createMockEvent());

    expect(consoleSpy).toHaveBeenCalledWith(
      '[ai-billling] StripeDestinationError',
      "Error: An error occurred internally with Stripe's API. Message:",
      'Internal Stripe API error',
      'Request ID:',
      'req_api_123',
    );
    consoleSpy.mockRestore();
  });

  it('should handle StripeConnectionError appropriately', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockCreateMeterEvent.mockRejectedValueOnce(
      new MockStripeError(
        'Connection failed',
        'StripeConnectionError',
        'req_conn_123',
      ),
    );

    const destination = createStripeDestination({
      apiKey: 'test-key',
      meterName: 'test-meter',
    });

    await destination(createMockEvent());

    expect(consoleSpy).toHaveBeenCalledWith(
      '[ai-billling] StripeDestinationError',
      'Error: Some kind of error occurred during the HTTPS communication. Message:',
      'Connection failed',
      'Request ID:',
      'req_conn_123',
    );
    consoleSpy.mockRestore();
  });

  it('should handle StripeAuthenticationError appropriately', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockCreateMeterEvent.mockRejectedValueOnce(
      new MockStripeError(
        'Invalid API Key',
        'StripeAuthenticationError',
        'req_auth_123',
      ),
    );

    const destination = createStripeDestination({
      apiKey: 'test-key',
      meterName: 'test-meter',
    });

    await destination(createMockEvent());

    expect(consoleSpy).toHaveBeenCalledWith(
      '[ai-billling] StripeDestinationError',
      'Error: You probably used an incorrect API key. Message:',
      'Invalid API Key',
      'Request ID:',
      'req_auth_123',
    );
    consoleSpy.mockRestore();
  });

  it('should handle default/unknown Stripe errors appropriately', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockCreateMeterEvent.mockRejectedValueOnce(
      new MockStripeError('Mock Error', 'UnknownStripeError', 'req_123'),
    );

    const destination = createStripeDestination({
      apiKey: 'test-key',
      meterName: 'test-meter',
    });

    await destination(createMockEvent());

    expect(consoleSpy).toHaveBeenCalledWith(
      '[ai-billling] StripeDestinationError',
      'Error: An unknown error occurred. Message:',
      'Mock Error',
      'Request ID:',
      'req_123',
    );
    consoleSpy.mockRestore();
  });

  it('should handle non-Stripe errors (the else block) appropriately', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Rejecting with a standard built-in JS Error, not a StripeError
    mockCreateMeterEvent.mockRejectedValueOnce(
      new Error('A completely random network timeout'),
    );

    const destination = createStripeDestination({
      apiKey: 'test-key',
      meterName: 'test-meter',
    });

    await destination(createMockEvent());

    expect(consoleSpy).toHaveBeenCalledWith(
      '[ai-billling] StripeDestinationError',
      'Error:',
      'A completely random network timeout',
    );
    consoleSpy.mockRestore();
  });

  it('should handle unknown/generic errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockCreateMeterEvent.mockRejectedValueOnce(
      new Error('Network disconnected'),
    );

    const destination = createStripeDestination({
      apiKey: 'test-key',
      meterName: 'test-meter',
    });

    await destination(createMockEvent());

    expect(consoleSpy).toHaveBeenCalledWith(
      '[ai-billling] StripeDestinationError',
      'Error:',
      'Network disconnected',
    );
    consoleSpy.mockRestore();
  });
  it('should skip metadata values that are null or undefined', async () => {
    const mockEvent = createMockEvent();

    const destination = createStripeDestination({
      apiKey: 'test-key',
      meterName: 'test-meter',
      // Force the metadata to include explicit null and undefined values
      mapMetadata: () => ({
        valid_key: 'i_am_included',
        explicit_null: null as unknown as string,
        explicit_undefined: undefined as unknown as string,
      }),
    });

    await destination(mockEvent);

    const callArgs = mockCreateMeterEvent.mock.calls[0]![0];
    const payload = callArgs.payload;

    expect(payload).toHaveProperty('valid_key', 'i_am_included');
    expect(payload).not.toHaveProperty('explicit_null');
    expect(payload).not.toHaveProperty('explicit_undefined');
  });

  it('should use a custom Stripe client if provided in options', async () => {
    const mockCustomClient = {
      billing: { meterEvents: { create: vi.fn() } },
    } as unknown as Stripe;

    const destination = createStripeDestination({
      client: mockCustomClient,
      meterName: 'test-meter',
    });

    await destination(createMockEvent());

    expect(mockCustomClient.billing.meterEvents.create).toHaveBeenCalled();
    expect(mockCreateMeterEvent).not.toHaveBeenCalled();
  });

  it('should fall back to an empty string if apiKey is not provided', () => {
    // Omit apiKey and client entirely
    const destination = createStripeDestination({
      meterName: 'test-meter',
    });
    expect(destination).toBeDefined();
  });

  it('should fall back to an empty object if event.tags is undefined', async () => {
    const destination = createStripeDestination({
      apiKey: 'test',
      meterName: 'test',
    });
    const eventWithoutTags = {
      generationId: 'gen-123',
      modelId: 'gpt-4',
      provider: 'openai',
      cost: { amount: 100, currency: 'USD', unit: 'nanos' },
    } as BillingEvent;

    await destination(eventWithoutTags);
    expect(mockCreateMeterEvent).toHaveBeenCalledTimes(1);
  });
});
