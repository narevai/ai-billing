import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOpenMeterDestination } from './openmeter-destination.js';
import type { BillingEvent } from '@ai-billing/core';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('OpenMeter Destination', () => {
  const createMockEvent = (
    overrides: Partial<BillingEvent> = {},
  ): BillingEvent => ({
    generationId: 'gen-123',
    modelId: 'gpt-4o',
    provider: 'openrouter',
    tags: { userId: 'user_42' },
    usage: {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      subProviderId: 'openai',
    },
    cost: { amount: 70100, currency: 'USD', unit: 'nanos' },
    ...overrides,
  });

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true });
  });

  it('should POST to /v3/openmeter/events', async () => {
    const destination = createOpenMeterDestination({
      apiKey: 'test-key',
      apiUrl: 'https://eu.api.konghq.com',
    });

    await destination(createMockEvent());

    expect(mockFetch).toHaveBeenCalledWith(
      'https://eu.api.konghq.com/v3/openmeter/events',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
          'Content-Type': 'application/cloudevents+json',
        }),
      }),
    );
  });

  it('should use llm_usage as default event_type', async () => {
    const destination = createOpenMeterDestination({ apiKey: 'key' });

    await destination(createMockEvent());

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body as string);
    expect(body.type).toBe('llm_usage');
  });

  it('should send cost_nanos and currency in data', async () => {
    const destination = createOpenMeterDestination({ apiKey: 'key' });

    await destination(createMockEvent());

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body as string);
    expect(body.data.cost_nanos).toBeGreaterThan(0);
    expect(body.data.currency).toBe('USD');
  });

  it('should set subject from userId tag', async () => {
    const destination = createOpenMeterDestination({ apiKey: 'key' });

    await destination(createMockEvent());

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body as string);
    expect(body.subject).toBe('user_42');
  });

  it('should use custom customerIdKey', async () => {
    const destination = createOpenMeterDestination({
      apiKey: 'key',
      customerIdKey: 'orgId',
    });

    await destination(createMockEvent({ tags: { orgId: 'org_99' } }));

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body as string);
    expect(body.subject).toBe('org_99');
  });

  it('should use custom eventType', async () => {
    const destination = createOpenMeterDestination({
      apiKey: 'key',
      eventType: 'custom_event',
    });

    await destination(createMockEvent());

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body as string);
    expect(body.type).toBe('custom_event');
  });

  it('should include metadata from buildMeterMetadata in data', async () => {
    const destination = createOpenMeterDestination({ apiKey: 'key' });

    await destination(createMockEvent());

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body as string);
    expect(body.data.model_id).toBe('gpt-4o');
    expect(body.data.provider).toBe('openrouter');
  });

  it('should use mapMetadata when provided', async () => {
    const destination = createOpenMeterDestination({
      apiKey: 'key',
      mapMetadata: () => ({ custom_field: 'custom_value' }),
    });

    await destination(createMockEvent());

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body as string);
    expect(body.data.custom_field).toBe('custom_value');
  });

  it('should warn and skip when no customer_id found', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const destination = createOpenMeterDestination({ apiKey: 'key' });

    await destination(createMockEvent({ tags: {} }));

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('customer_id'),
    );
    expect(mockFetch).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('should log error on 429 rate limit', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => '',
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const destination = createOpenMeterDestination({ apiKey: 'key' });

    await destination(createMockEvent());

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Rate limit'),
    );
    errorSpy.mockRestore();
  });

  it('should log error on 422 invalid parameters', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => 'bad request',
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const destination = createOpenMeterDestination({ apiKey: 'key' });

    await destination(createMockEvent());

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid parameters'),
      expect.anything(),
    );
    errorSpy.mockRestore();
  });

  it('should log error on 401 unauthorized', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => '',
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const destination = createOpenMeterDestination({ apiKey: 'bad-key' });

    await destination(createMockEvent());

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unauthorized'),
    );
    errorSpy.mockRestore();
  });

  it('should log error on unexpected response status', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'server error',
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const destination = createOpenMeterDestination({ apiKey: 'key' });

    await destination(createMockEvent());

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unexpected response'),
      expect.anything(),
    );
    errorSpy.mockRestore();
  });

  it('should log error on network failure', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const destination = createOpenMeterDestination({ apiKey: 'key' });

    await destination(createMockEvent());

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Network error'),
      expect.anything(),
    );
    errorSpy.mockRestore();
  });

  it('should log error on generic non-network failure', async () => {
    mockFetch.mockRejectedValue(new Error('Something went wrong'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const destination = createOpenMeterDestination({ apiKey: 'key' });

    await destination(createMockEvent());

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('OpenMeterDestination Error:'),
      expect.anything(),
    );
    errorSpy.mockRestore();
  });

  it('should default to https://eu.api.konghq.com', async () => {
    const destination = createOpenMeterDestination({ apiKey: 'key' });

    await destination(createMockEvent());

    expect(mockFetch.mock.calls[0]![0]).toBe(
      'https://eu.api.konghq.com/v3/openmeter/events',
    );
  });
});
