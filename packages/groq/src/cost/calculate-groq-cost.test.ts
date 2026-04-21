import { describe, it, expect } from 'vitest';
import { calculateGroqCost } from './calculate-groq-cost.js';
import type { ModelPricing } from '@ai-billing/core';

describe('calculateGroqCost (Integration)', () => {
  it('should return undefined if no pricing is provided', () => {
    const result = calculateGroqCost({
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

  it('should calculate the exact cost based on real-world log data (moonshotai/kimi-k2-0905)', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.000001,
      completionTokens: 0.000003,
      inputCacheReadTokens: 0.0000005,
      inputCacheWriteTokens: 0,
      request: 0,
    };

    const usage = {
      promptTokens: 41,
      completionTokens: 26,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    };

    const result = calculateGroqCost({ pricing: mockPricing, usage });

    // Expected logic check in Nanos (1 USD = 1,000,000,000 nanos):
    // Prompt nanos: 0.000001 * 1e9 * 41 = 41,000 nanos ($0.000041)
    // Completion nanos: 0.000003 * 1e9 * 26 = 78,000 nanos ($0.000078)
    // Total nanos: 119,000 ($0.000119)
    expect(result).toEqual({
      amount: 119000,
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

    const result = calculateGroqCost({ pricing: mockPricing, usage });

    // Total: 2,000 + 5,000 + 10,000 + 0 + 4,000 + 10,000,000 (request flat fee) = 10,021,000 nanos
    expect(result).toEqual({
      amount: 10021000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should fallback to completion token price if reasoning token price is undefined', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.0000002,
      completionTokens: 0.000001, // $1.00 per 1M
    };

    const usage = {
      promptTokens: 0,
      completionTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 10, // Should use the 0.000001 completion price -> 10,000 nanos
    };

    const result = calculateGroqCost({ pricing: mockPricing, usage });

    expect(result).toEqual({
      amount: 10000,
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

    const result = calculateGroqCost({
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

    const result = calculateGroqCost({ pricing: mockPricing, usage });

    // 20,000 nanos - 10% = 18,000 nanos
    expect(result).toEqual({
      amount: 18000,
      unit: 'nanos',
      currency: 'USD',
    });
  });
});
