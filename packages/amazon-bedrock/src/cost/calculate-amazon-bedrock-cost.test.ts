import { describe, it, expect } from 'vitest';
import { calculateAmazonBedrockCost } from './calculate-amazon-bedrock-cost.js';
import type { ModelPricing, CostInputs } from '@ai-billing/types';

describe('calculateAmazonBedrockCost', () => {
  it('should return undefined if no pricing is provided', () => {
    const result = calculateAmazonBedrockCost({
      pricing: undefined,
      usage: {
        promptTokens: 10,
        completionTokens: 10,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        reasoningTokens: 0,
      },
    });

    expect(result).toBeUndefined();
  });

  it('should calculate cost for the captured generateText usage (us.amazon.nova-lite-v1:0, inputTokens: 7, outputTokens: 850, no cache)', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.00000006, // $0.06 per 1M tokens
      completionTokens: 0.00000024, // $0.24 per 1M tokens
      inputCacheReadTokens: 0.000000015,
      inputCacheWriteTokens: 0.0000000375,
      request: 0,
    };

    const usage = {
      promptTokens: 7,
      completionTokens: 850,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    };

    const result = calculateAmazonBedrockCost({ pricing: mockPricing, usage });

    // Prompt: 0.00000006 * 1e9 * 7 = 420 nanos
    // Completion: 0.00000024 * 1e9 * 850 = 204,000 nanos
    // Total: 420 + 204,000 = 204,420 nanos
    expect(result).toEqual({
      amount: 204420,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should calculate cost for the captured streamText usage (us.amazon.nova-lite-v1:0, inputTokens: 7, outputTokens: 251, no cache)', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.00000006,
      completionTokens: 0.00000024,
      request: 0,
    };

    const usage = {
      promptTokens: 7,
      completionTokens: 251,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    };

    const result = calculateAmazonBedrockCost({ pricing: mockPricing, usage });

    // Prompt: 0.00000006 * 1e9 * 7 = 420 nanos
    // Completion: 0.00000024 * 1e9 * 251 = 60,240 nanos
    // Total: 420 + 60,240 = 60,660 nanos
    expect(result).toEqual({
      amount: 60660,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should add cache-read and cache-write cost on top of the full prompt cost, without subtracting from promptTokens', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.000002,
      completionTokens: 0.000006,
      inputCacheReadTokens: 0.0000002,
      inputCacheWriteTokens: 0.0000025,
      request: 0,
    };

    const usage = {
      // Bedrock's Converse API `inputTokens` already excludes cache-read/cache-write tokens, so the full
      // promptTokens value is billed at the prompt rate; cache costs are added on top, never subtracted.
      promptTokens: 80,
      completionTokens: 20,
      cacheReadTokens: 40,
      cacheWriteTokens: 15,
      reasoningTokens: 0,
    };

    const result = calculateAmazonBedrockCost({ pricing: mockPricing, usage });

    // Prompt (full, not reduced by cache): 80 * 0.000002 * 1e9 = 160,000 nanos
    // Cache read: 40 * 0.0000002 * 1e9 = 8,000 nanos
    // Cache write: 15 * 0.0000025 * 1e9 = 37,500 nanos
    // Completion: 20 * 0.000006 * 1e9 = 120,000 nanos
    // Total: 160,000 + 8,000 + 37,500 + 120,000 = 325,500 nanos
    expect(result).toEqual({
      amount: 325500,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should apply discount correctly', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.000001,
      completionTokens: 0.000002,
      discount: 0.1,
    };

    const usage = {
      promptTokens: 1000,
      completionTokens: 500,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    };

    const result = calculateAmazonBedrockCost({ pricing: mockPricing, usage });

    // Gross: 0.000001 * 1e9 * 1000 + 0.000002 * 1e9 * 500 = 2,000,000 nanos
    // After 10% discount: 1,800,000 nanos
    expect(result).toEqual({
      amount: 1800000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should include web search cost when both pricing.webSearch and usage.webSearchCount are provided', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.000001,
      completionTokens: 0.000003,
      request: 0,
      webSearch: 0.000005,
    };

    const usage = {
      promptTokens: 41,
      completionTokens: 26,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
      webSearchCount: 3,
    };

    const result = calculateAmazonBedrockCost({ pricing: mockPricing, usage });

    // Prompt: 0.000001 * 1e9 * 41 = 41,000 nanos
    // Completion: 0.000003 * 1e9 * 26 = 78,000 nanos
    // Web search: 0.000005 * 1e9 * 3 = 15,000 nanos
    // Total: 41,000 + 78,000 + 15,000 = 134,000 nanos
    expect(result).toEqual({
      amount: 134000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should default cacheReadTokens to 0 when omitted from usage (defensive fallback for non-strict callers)', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.000002,
      completionTokens: 0.000004,
      inputCacheReadTokens: 0.0000005,
      inputCacheWriteTokens: 0.000001,
      request: 0,
    };

    // `CostInputs` declares `cacheReadTokens` as required, but callers that skip strict TS
    // checks (or upstream extraction bugs) may still omit it at runtime.
    const usage = {
      promptTokens: 50,
      completionTokens: 30,
      cacheWriteTokens: 10,
      reasoningTokens: 0,
    } as unknown as CostInputs;

    const usageWithExplicitZero = {
      ...usage,
      cacheReadTokens: 0,
    };

    const result = calculateAmazonBedrockCost({ pricing: mockPricing, usage });
    const resultWithExplicitZero = calculateAmazonBedrockCost({
      pricing: mockPricing,
      usage: usageWithExplicitZero,
    });

    expect(result).toEqual(resultWithExplicitZero);
    // Prompt: 0.000002 * 1e9 * 50 = 100,000 nanos
    // Completion: 0.000004 * 1e9 * 30 = 120,000 nanos
    // Cache write: 0.000001 * 1e9 * 10 = 10,000 nanos
    // Cache read defaults to 0 tokens, so cache read cost is 0.
    // Total: 100,000 + 120,000 + 10,000 = 230,000 nanos
    expect(result).toEqual({
      amount: 230000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should default reasoningTokens to 0 when omitted from usage (defensive fallback for non-strict callers)', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.0000003,
      completionTokens: 0.0000009,
      inputCacheReadTokens: 0.0000001,
      request: 0,
    };

    // `CostInputs` declares `reasoningTokens` as required, but callers that skip strict TS
    // checks (or upstream extraction bugs) may still omit it at runtime.
    const usage = {
      promptTokens: 25,
      completionTokens: 40,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    } as unknown as CostInputs;

    const usageWithExplicitZero = {
      ...usage,
      reasoningTokens: 0,
    };

    const result = calculateAmazonBedrockCost({ pricing: mockPricing, usage });
    const resultWithExplicitZero = calculateAmazonBedrockCost({
      pricing: mockPricing,
      usage: usageWithExplicitZero,
    });

    expect(result).toEqual(resultWithExplicitZero);
    // Prompt: 0.0000003 * 1e9 * 25 = 7,500 nanos
    // Completion: 0.0000009 * 1e9 * 40 = 36,000 nanos
    // Reasoning defaults to 0 tokens, so reasoning cost is 0 (additive, nothing shifted from completion).
    // Total: 7,500 + 36,000 = 43,500 nanos
    expect(result).toEqual({
      amount: 43500,
      unit: 'nanos',
      currency: 'USD',
    });
  });
});
