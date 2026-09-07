import { describe, it, expect } from 'vitest';
import { calculateGoogleVertexCost } from './calculate-google-vertex-cost.js';
import type { ModelPricing } from '@ai-billing/types';

describe('calculateGoogleVertexCost (Integration)', () => {
  const actualPricing: ModelPricing = {
    promptTokens: 0.0000003, // $0.30 per 1M (Gemini 2.5 Flash order of magnitude)
    completionTokens: 0.0000025, // $2.50 per 1M
    inputCacheReadTokens: 0.000000075, // $0.075 per 1M
    inputCacheWriteTokens: 0.000000375, // $0.375 per 1M
    internalReasoningTokens: 0.0000025, // $2.50 per 1M (same as completion)
    request: 0,
    discount: 0,
  };

  it('should return undefined if no pricing is provided', () => {
    const result = calculateGoogleVertexCost({
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

  it('should calculate the exact cost based on the real captured gemini-2.5-flash usage payload from issue #314', () => {
    // Captured payload: promptTokenCount: 7, candidatesTokenCount: 9, thoughtsTokenCount: 50,
    // totalTokenCount: 66. Completion billing must include the 50 reasoning tokens on top of the 9
    // visible candidate tokens (per the issue's usage-shape notes).
    const usage = {
      promptTokens: 7,
      completionTokens: 59, // 9 candidate tokens + 50 reasoning tokens
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 50,
    };
    const result = calculateGoogleVertexCost({ pricing: actualPricing, usage });

    // Prompt nanos: 0.0000003 * 1e9 * 7 = 2,100 nanos
    // Completion nanos: 0.0000025 * 1e9 * (59 - 50) = 22,500 nanos
    // Reasoning nanos: 0.0000025 * 1e9 * 50 = 125,000 nanos
    // Total: 2,100 + 22,500 + 125,000 = 149,600 nanos
    expect(result).toEqual({
      amount: 149600,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should handle caching and reasoning tokens correctly', () => {
    const usage = {
      promptTokens: 100, // 100 * 0.0000003 = 30,000 nanos
      completionTokens: 50, // 50 * 0.0000025 = 125,000 nanos
      cacheReadTokens: 1000, // 1000 * 0.000000075 = 75,000 nanos
      cacheWriteTokens: 2000, // 2000 * 0.000000375 = 750,000 nanos
      reasoningTokens: 0,
    };

    const result = calculateGoogleVertexCost({
      pricing: actualPricing,
      usage,
    });

    // Total: 30,000 + 125,000 + 75,000 + 750,000 = 980,000 nanos
    expect(result).toEqual({
      amount: 980000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should bill request and web search flat fees when set', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0,
      completionTokens: 0,
      request: 0.001, // $0.001 flat fee per request
      webSearch: 0.03, // $0.03 per grounded search
    };

    const result = calculateGoogleVertexCost({
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

    // request: 0.001 * 1e9 = 1,000,000 nanos
    // webSearch: 2 * 0.03 * 1e9 = 60,000,000 nanos
    // Total: 61,000,000 nanos
    expect(result).toEqual({
      amount: 61000000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should apply a discount correctly if one is provided in pricing', () => {
    const discountedPricing: ModelPricing = {
      ...actualPricing,
      discount: 0.5, // 50% discount
    };

    const usage = {
      promptTokens: 1000, // 1000 * 0.0000003 = 300,000 nanos
      completionTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    };

    const result = calculateGoogleVertexCost({
      pricing: discountedPricing,
      usage,
    });

    // 300,000 nanos * 50% discount = 150,000 nanos
    expect(result).toEqual({
      amount: 150000,
      unit: 'nanos',
      currency: 'USD',
    });
  });
});
