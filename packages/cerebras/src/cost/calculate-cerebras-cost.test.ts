import { describe, it, expect } from 'vitest';
import { calculateCerebrasCost } from './calculate-cerebras-cost.js';
import type { ModelPricing } from '@ai-billing/types';

describe('calculateCerebrasCost', () => {
  it('should return undefined if no pricing is provided', () => {
    const result = calculateCerebrasCost({
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

    const result = calculateCerebrasCost({ pricing: mockPricing, usage });

    // Prompt: 0.000001 * 1e9 * 41 = 41,000 nanos
    // Completion: 0.000003 * 1e9 * 26 = 78,000 nanos
    // Total: 119,000 nanos
    expect(result).toEqual({
      amount: 119000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should calculate cost for the captured gpt-oss-120b generate-text usage (prompt_tokens: 74, completion_tokens: 72, reasoning_tokens: 28, cached_tokens: 0, see issue #290)', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.0000002,
      completionTokens: 0.0000006,
      inputCacheReadTokens: 0.00000005,
      request: 0,
    };

    const usage = {
      promptTokens: 74,
      completionTokens: 72,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 28,
    };

    const result = calculateCerebrasCost({ pricing: mockPricing, usage });

    // Prompt: 0.0000002 * 1e9 * (74 - 0) = 14,800 nanos
    // Completion (non-reasoning): 0.0000006 * 1e9 * (72 - 28) = 26,400 nanos
    // Reasoning: 0.0000006 * 1e9 * 28 = 16,800 nanos
    // Total: 14,800 + 26,400 + 16,800 = 58,000 nanos
    expect(result).toEqual({
      amount: 58000,
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
      promptTokens: 80, // Total input tokens
      completionTokens: 20,
      cacheReadTokens: 40, // Subset of input tokens
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    };

    const result = calculateCerebrasCost({ pricing: mockPricing, usage });

    // Prompt (non-cached): (80 - 40) = 40 * 0.000002 * 1e9 = 80,000 nanos
    // Cache read: 40 * 0.000001 * 1e9 = 40,000 nanos
    // Completion: 20 * 0.000006 * 1e9 = 120,000 nanos
    // Total: 80,000 + 40,000 + 120,000 = 240,000 nanos
    expect(result).toEqual({
      amount: 240000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should deduct reasoning tokens from completion tokens correctly (gpt-oss-120b reasoning usage)', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.0000003,
      completionTokens: 0.0000005,
      inputCacheReadTokens: 0.000000075,
      request: 0,
    };

    const usage = {
      promptTokens: 22,
      completionTokens: 289,
      cacheReadTokens: 4,
      cacheWriteTokens: 0,
      reasoningTokens: 227,
    };

    const result = calculateCerebrasCost({ pricing: mockPricing, usage });

    // Prompt: 0.0000003 * 1e9 * (22 - 4) = 5,400 nanos
    // Completion: 0.0000005 * 1e9 * (289 - 227) = 31,000 nanos
    // Cache read: 0.000000075 * 1e9 * 4 = 300 nanos
    // Reasoning: 0.0000005 * 1e9 * 227 = 113,500 nanos
    // Total: 5,400 + 31,000 + 300 + 113,500 = 150,200 nanos
    expect(result).toEqual({
      amount: 150200,
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

    const result = calculateCerebrasCost({ pricing: mockPricing, usage });

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

    const result = calculateCerebrasCost({ pricing: mockPricing, usage });

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
});
