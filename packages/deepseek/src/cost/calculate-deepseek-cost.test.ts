import { describe, it, expect } from 'vitest';
import { calculateDeepSeekCost } from './calculate-deepseek-cost.js';
import type { ModelPricing } from '@ai-billing/core';

describe('calculateDeepSeekCost', () => {
  it('should return undefined if no pricing is provided', () => {
    const result = calculateDeepSeekCost({
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

  it('should calculate basic cost for deepseek-chat', () => {
    const mockPricing: ModelPricing = {
      // deepseek-chat: $0.27/1M input (cache miss), $0.07/1M input (cache hit), $1.10/1M output
      promptTokens: 0.00000027,
      completionTokens: 0.0000011,
      inputCacheReadTokens: 0.00000007,
      inputCacheWriteTokens: 0,
      request: 0,
    };

    const usage = {
      promptTokens: 1000,
      completionTokens: 500,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    };

    const result = calculateDeepSeekCost({ pricing: mockPricing, usage });

    // Prompt: 0.00000027 * 1e9 * 1000 = 270,000 nanos
    // Completion: 0.0000011 * 1e9 * 500 = 550,000 nanos
    // Total: 820,000 nanos
    expect(result).toEqual({
      amount: 820000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should apply cache read discount correctly', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.00000027,
      completionTokens: 0.0000011,
      inputCacheReadTokens: 0.00000007,
      inputCacheWriteTokens: 0,
      request: 0,
    };

    const usage = {
      promptTokens: 800,
      completionTokens: 200,
      cacheReadTokens: 500,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    };

    const result = calculateDeepSeekCost({ pricing: mockPricing, usage });

    // nonCachedPrompt: (800 - 500) * 270 = 81,000 nanos
    // CacheRead: 500 * 70 = 35,000 nanos
    // Completion: 200 * 1100 = 220,000 nanos
    // Total: 336,000 nanos
    expect(result).toEqual({
      amount: 336000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should handle reasoning tokens for deepseek-reasoner', () => {
    const mockPricing: ModelPricing = {
      // deepseek-reasoner: $0.55/1M input, $2.19/1M output, reasoning at output rate
      promptTokens: 0.00000055,
      completionTokens: 0.00000219,
      inputCacheReadTokens: 0.00000014,
      inputCacheWriteTokens: 0,
      internalReasoningTokens: 0.00000219,
      request: 0,
    };

    const usage = {
      promptTokens: 100,
      completionTokens: 50,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 200,
    };

    const result = calculateDeepSeekCost({ pricing: mockPricing, usage });

    // Prompt: 100 * 550 = 55000 nanos
    // Completion: 50 * 2190 = 109500 nanos
    // Reasoning: 200 * 2190 = 438000 nanos
    // Total: 602500 nanos
    expect(result).toEqual({
      amount: 602500,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should apply discount correctly', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.000001,
      completionTokens: 0.000002,
      discount: 0.1, // 10% discount
    };

    const usage = {
      promptTokens: 1000,
      completionTokens: 500,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    };

    const result = calculateDeepSeekCost({ pricing: mockPricing, usage });

    // Gross: 1000 * 1000 + 500 * 2000 = 2,000,000 nanos
    // After 10% discount: 1,800,000 nanos
    expect(result).toEqual({
      amount: 1800000,
      unit: 'nanos',
      currency: 'USD',
    });
  });
});
