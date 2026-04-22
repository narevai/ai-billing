import { describe, it, expect } from 'vitest';
import { calculateChutesCost } from './calculate-chutes-cost.js';
import type { ModelPricing } from '@ai-billing/core';

describe('calculateChutesCost', () => {
  it('should return undefined if no pricing is provided', () => {
    const result = calculateChutesCost({
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

  it('should calculate basic cost correctly', () => {
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

    const result = calculateChutesCost({ pricing: mockPricing, usage });

    // Prompt: 0.000001 * 1e9 * 41 = 41,000 nanos
    // Completion: 0.000003 * 1e9 * 26 = 78,000 nanos
    // Total: 119,000 nanos
    expect(result).toEqual({
      amount: 119000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should deduct cached tokens from prompt correctly', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.000002,
      completionTokens: 0.000006,
      inputCacheReadTokens: 0.000001,
      inputCacheWriteTokens: 0,
      request: 0,
    };

    const usage = {
      promptTokens: 80,
      completionTokens: 20,
      cacheReadTokens: 40,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    };

    const result = calculateChutesCost({ pricing: mockPricing, usage });

    // Prompt (non-cached): 0.000002 * 1e9 * 80 = 160,000 nanos
    // Cache read: 0.000001 * 1e9 * 40 = 40,000 nanos
    // Completion: 0.000006 * 1e9 * 20 = 120,000 nanos
    // Total: 320,000 nanos
    expect(result).toEqual({
      amount: 320000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should handle reasoning tokens correctly', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.0000002,
      completionTokens: 0.000001,
      internalReasoningTokens: 0.000002,
      request: 0,
    };

    const usage = {
      promptTokens: 10,
      completionTokens: 5,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 2,
    };

    const result = calculateChutesCost({ pricing: mockPricing, usage });

    // Prompt: 0.0000002 * 1e9 * 10 = 2,000 nanos
    // Completion: 0.000001 * 1e9 * 5 = 5,000 nanos
    // Reasoning: 0.000002 * 1e9 * 2 = 4,000 nanos
    // Total: 11,000 nanos
    expect(result).toEqual({
      amount: 11000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should fallback to completion rate for reasoning when internalReasoningTokens is undefined', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.0000002,
      completionTokens: 0.000001,
    };

    const usage = {
      promptTokens: 0,
      completionTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 10,
    };

    const result = calculateChutesCost({ pricing: mockPricing, usage });

    // Reasoning: 0.000001 * 1e9 * 10 = 10,000 nanos
    expect(result).toEqual({
      amount: 10000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should fallback to half prompt rate for cache read when inputCacheReadTokens is undefined', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.000002,
      completionTokens: 0.000006,
    };

    const usage = {
      promptTokens: 0,
      completionTokens: 0,
      cacheReadTokens: 100,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    };

    const result = calculateChutesCost({ pricing: mockPricing, usage });

    // Cache read: 0.000001 * 1e9 * 100 = 100,000 nanos (half of prompt rate)
    expect(result).toEqual({
      amount: 100000,
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

    const result = calculateChutesCost({ pricing: mockPricing, usage });

    // Gross: 0.000001 * 1e9 * 1000 + 0.000002 * 1e9 * 500 = 2,000,000 nanos
    // After 10% discount: 1,800,000 nanos
    expect(result).toEqual({
      amount: 1800000,
      unit: 'nanos',
      currency: 'USD',
    });
  });
});
