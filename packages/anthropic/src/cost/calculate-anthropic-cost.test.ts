import { describe, it, expect } from 'vitest';
import { calculateAnthropicCost } from './calculate-anthropic-cost.js';
import type { ModelPricing } from '@ai-billing/core';

describe('calculateAnthropicCost (Integration)', () => {
  it('should return undefined if no pricing is provided', () => {
    const result = calculateAnthropicCost({
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

  it('should calculate the exact cost based on the real-world CSV data (claude-4.6-sonnet)', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.000003, // $3.00 per 1M tokens
      completionTokens: 0.000015, // $15.00 per 1M tokens
      inputCacheReadTokens: 0,
      inputCacheWriteTokens: 0,
      request: 0,
    };

    const usage = {
      promptTokens: 24,
      completionTokens: 62,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    };

    const result = calculateAnthropicCost({ pricing: mockPricing, usage });

    // Prompt nanos: 0.000003 * 1e9 * 24 = 72,000 nanos ($0.000072)
    // Completion nanos: 0.000015 * 1e9 * 62 = 930,000 nanos ($0.00093)
    // Total nanos: 1,002,000
    // In USD: $0.001002 (Matches upstream_inference_cost exactly)
    expect(result).toEqual({
      amount: 1002000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should handle caching and reasoning tokens correctly', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.0000002,
      completionTokens: 0.000001,
      inputCacheReadTokens: 0.0000001, // 50% discount for cache reads
      inputCacheWriteTokens: 0.0000002,
      internalReasoningTokens: 0.000002, // Premium for reasoning
      request: 0.01, // Flat 1 cent per request (10,000,000 nanos)
    };

    const usage = {
      promptTokens: 10, // 10 * 200 = 2,000 nanos
      completionTokens: 5, // 5 * 1,000 = 5,000 nanos
      cacheReadTokens: 100, // 100 * 100 = 10,000 nanos
      cacheWriteTokens: 0, // 0
      reasoningTokens: 2, // 2 * 2,000 = 4,000 nanos
    };

    const result = calculateAnthropicCost({ pricing: mockPricing, usage });

    // Total: 2,000 + 5,000 + 10,000 + 0 + 4,000 + 10,000,000 (request flat fee) = 10,021,000 nanos
    expect(result).toEqual({
      amount: 10021000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should bill web search calls when webSearch price is set', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0,
      completionTokens: 0,
      webSearch: 0.03, // $0.03 per search = 30,000,000 nanos
    };

    const result = calculateAnthropicCost({
      pricing: mockPricing,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        reasoningTokens: 0,
        webSearchCount: 2,
      },
    });

    // 2 * 0.03 * 1e9 = 60,000,000 nanos
    expect(result).toEqual({
      amount: 60000000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should apply a discount correctly if one is provided in pricing', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.0000002,
      completionTokens: 0,
      discount: 0.1, // 10% discount
    };

    const usage = {
      promptTokens: 100, // 100 * 200 nanos = 20,000 nanos
      completionTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    };

    const result = calculateAnthropicCost({ pricing: mockPricing, usage });

    // 20,000 nanos - 10% = 18,000 nanos
    expect(result).toEqual({
      amount: 18000,
      unit: 'nanos',
      currency: 'USD',
    });
  });
});
