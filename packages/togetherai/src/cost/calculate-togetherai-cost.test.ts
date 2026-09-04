import { describe, it, expect } from 'vitest';
import { calculateTogetheraiCost } from './calculate-togetherai-cost.js';
import type { ModelPricing } from '@ai-billing/types';

describe('calculateTogetheraiCost', () => {
  it('should return undefined if no pricing is provided', () => {
    const result = calculateTogetheraiCost({
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

    const result = calculateTogetheraiCost({ pricing: mockPricing, usage });

    // Prompt: 0.000001 * 1e9 * 41 = 41,000 nanos
    // Completion: 0.000003 * 1e9 * 26 = 78,000 nanos
    // Total: 119,000 nanos
    expect(result).toEqual({
      amount: 119000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should calculate cost for the captured Together AI generateText usage (prompt_tokens: 74, completion_tokens: 36, reasoning_tokens: 0)', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.05 / 1_000_000,
      completionTokens: 0.2 / 1_000_000,
      request: 0,
    };

    const usage = {
      promptTokens: 74,
      completionTokens: 36,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    };

    const result = calculateTogetheraiCost({ pricing: mockPricing, usage });

    // Prompt: (0.05 / 1e6) * 1e9 * 74 = 3,700 nanos
    // Completion: (0.2 / 1e6) * 1e9 * 36 = 7,200 nanos
    // Total: 3,700 + 7,200 = 10,900 nanos
    expect(result).toEqual({
      amount: 10900,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should calculate cost for the captured Together AI streamText usage (prompt_tokens: 74, completion_tokens: 44, reasoning_tokens: 0)', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.05 / 1_000_000,
      completionTokens: 0.2 / 1_000_000,
      request: 0,
    };

    const usage = {
      promptTokens: 74,
      completionTokens: 44,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    };

    const result = calculateTogetheraiCost({ pricing: mockPricing, usage });

    // Prompt: (0.05 / 1e6) * 1e9 * 74 = 3,700 nanos
    // Completion: (0.2 / 1e6) * 1e9 * 44 = 8,800 nanos
    // Total: 3,700 + 8,800 = 12,500 nanos
    expect(result).toEqual({
      amount: 12500,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should deduct reasoning tokens from completion tokens correctly (speculative — no confirmed non-zero reasoning_tokens response observed for Together AI yet)', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.0000003,
      completionTokens: 0.0000005,
      inputCacheReadTokens: 0.000000075,
      request: 0,
    };

    const usage = {
      promptTokens: 22,
      completionTokens: 289,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 227,
    };

    const result = calculateTogetheraiCost({ pricing: mockPricing, usage });

    // Prompt: 0.0000003 * 1e9 * (22 - 0) = 6,600 nanos
    // Completion: 0.0000005 * 1e9 * (289 - 227) = 31,000 nanos
    // Reasoning: 0.0000005 * 1e9 * 227 = 113,500 nanos
    // Total: 6,600 + 31,000 + 113,500 = 151,100 nanos
    expect(result).toEqual({
      amount: 151100,
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

    const result = calculateTogetheraiCost({ pricing: mockPricing, usage });

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

    const result = calculateTogetheraiCost({ pricing: mockPricing, usage });

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
