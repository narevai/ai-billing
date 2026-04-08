import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLagoDestination } from './lago-destination.js';
import { costToNumber } from '@ai-billing/core';
import type { BillingEvent } from '@ai-billing/core';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('Lago Destination', () => {
  const createMockEvent = (overrides: Partial<BillingEvent> = {}): BillingEvent => ({
    generationId: 'gen-123',
    modelId: 'gpt-4o',
    provider: 'openai',
    tags: { userId: 'user_42' },
    usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    cost: { amount: 70100, currency: 'USD', unit: 'nanos' },
    ...overrides,
  });

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true });
  });

  it('should POST to /api/v1/events', async () => {
    const destination = createLagoDestination({
      apiKey: 'test-key',
      apiUrl: 'http://localhost:3000',
      meterCode: 'llm_cost',
    });

    await destination(createMockEvent());

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/events',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('should send cost_micros as the billing value', async () => {
    const event = createMockEvent();
    const destination = createLagoDestination({
      apiKey: 'key',
      apiUrl: 'http://localhost:3000',
      meterCode: 'llm_cost',
    });

    await destination(event);

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body as string);
    expect(body.event.properties.cost_micros).toBe(costToNumber(event.cost!, 'micros'));
  });

  it('should include meter metadata as properties', async () => {
    const destination = createLagoDestination({
      apiKey: 'key',
      apiUrl: 'http://localhost:3000',
      meterCode: 'llm_cost',
    });

    await destination(createMockEvent());

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body as string);
    const props = body.event.properties;

    expect(props.provider).toBe('openai');
    expect(props.model_id).toBe('gpt-4o');
    expect(props.generation_id).toBe('gen-123');
    expect(props.input_tokens).toBe(100);
    expect(props.output_tokens).toBe(50);
  });

  it('should use userId as external_customer_id', async () => {
    const destination = createLagoDestination({
      apiKey: 'key',
      apiUrl: 'http://localhost:3000',
      meterCode: 'llm_cost',
    });

    await destination(createMockEvent());

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body as string);
    expect(body.event.external_customer_id).toBe('user_42');
  });

  it('should use custom externalCustomerIdKey', async () => {
    const destination = createLagoDestination({
      apiKey: 'key',
      apiUrl: 'http://localhost:3000',
      meterCode: 'llm_cost',
      externalCustomerIdKey: 'orgId',
    });

    await destination(createMockEvent({ tags: { orgId: 'org_99' } }));

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body as string);
    expect(body.event.external_customer_id).toBe('org_99');
  });

  it('should support meterCode as function', async () => {
    const destination = createLagoDestination({
      apiKey: 'key',
      apiUrl: 'http://localhost:3000',
      meterCode: event => `llm_cost_${event.provider}`,
    });

    await destination(createMockEvent());

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body as string);
    expect(body.event.code).toBe('llm_cost_openai');
  });

  it('should use custom mapMetadata when provided', async () => {
    const destination = createLagoDestination({
      apiKey: 'key',
      apiUrl: 'http://localhost:3000',
      meterCode: 'llm_cost',
      mapMetadata: () => ({ custom: 42 }),
    });

    await destination(createMockEvent());

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body as string);
    expect(body.event.properties.custom).toBe(42);
    expect(body.event.properties.cost_micros).toBeDefined();
  });

  it('should warn and skip when no external_customer_id found', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const destination = createLagoDestination({
      apiKey: 'key',
      apiUrl: 'http://localhost:3000',
      meterCode: 'llm_cost',
    });

    await destination(createMockEvent({ tags: {} }));

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('external_customer_id'));
    expect(mockFetch).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('should log error on 422 invalid parameters', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 422, text: async () => 'error body' });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const destination = createLagoDestination({
      apiKey: 'key',
      apiUrl: 'http://localhost:3000',
      meterCode: 'llm_cost',
    });

    await destination(createMockEvent());

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid parameters'),
      expect.anything(),
    );
    errorSpy.mockRestore();
  });

  it('should log error on 401 unauthorized', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401, text: async () => '' });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const destination = createLagoDestination({
      apiKey: 'bad-key',
      apiUrl: 'http://localhost:3000',
      meterCode: 'llm_cost',
    });

    await destination(createMockEvent());

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Unauthorized'));
    errorSpy.mockRestore();
  });

  it('should log error on network failure', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const destination = createLagoDestination({
      apiKey: 'key',
      apiUrl: 'http://localhost:3000',
      meterCode: 'llm_cost',
    });

    await destination(createMockEvent());

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Network error'),
      expect.anything(),
    );
    errorSpy.mockRestore();
  });

  it('should send timestamp as unix seconds', async () => {
    const before = Math.floor(Date.now() / 1000);
    const destination = createLagoDestination({
      apiKey: 'key',
      apiUrl: 'http://localhost:3000',
      meterCode: 'llm_cost',
    });

    await destination(createMockEvent());
    const after = Math.floor(Date.now() / 1000);

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body as string);
    expect(body.event.timestamp).toBeGreaterThanOrEqual(before);
    expect(body.event.timestamp).toBeLessThanOrEqual(after);
  });

  it('should default to https://api.getlago.com', async () => {
    const destination = createLagoDestination({
      apiKey: 'key',
      meterCode: 'llm_cost',
    });

    await destination(createMockEvent());

    expect(mockFetch.mock.calls[0]![0]).toBe('https://api.getlago.com/api/v1/events');
  });
});
