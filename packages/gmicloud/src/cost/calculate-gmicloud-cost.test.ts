import { describe, it, expect } from 'vitest';
import { calculateGmicloudCost } from './calculate-gmicloud-cost.js';
import type { ModelPricing, CostInputs } from '@ai-billing/types';

describe('calculateGmicloudCost', () => {
  it('should return undefined if no pricing is provided', () => {
    const result = calculateGmicloudCost({
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

    const result = calculateGmicloudCost({ pricing: mockPricing, usage });

    // Prompt: 0.000001 * 1e9 * 41 = 41,000 nanos
    // Completion: 0.000003 * 1e9 * 26 = 78,000 nanos
    // Total: 119,000 nanos
    expect(result).toEqual({
      amount: 119000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should calculate cost for the captured DeepSeek-V4-Flash-0731 generate-text usage (prompt_tokens: 90, completion_tokens: 14, reasoning_tokens: 11, cached_tokens: 0)', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.000001,
      completionTokens: 0.000003,
      request: 0,
    };

    const usage = {
      promptTokens: 90,
      completionTokens: 14,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 11,
    };

    const result = calculateGmicloudCost({ pricing: mockPricing, usage });

    // Prompt: 0.000001 * 1e9 * (90 - 0) = 90,000 nanos
    // Completion: 0.000003 * 1e9 * (14 - 11) = 9,000 nanos
    // Reasoning: 0.000003 * 1e9 * 11 = 33,000 nanos
    // Total: 90,000 + 9,000 + 33,000 = 132,000 nanos
    expect(result).toEqual({
      amount: 132000,
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

    const result = calculateGmicloudCost({ pricing: mockPricing, usage });

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

  it('should deduct reasoning tokens from completion tokens correctly', () => {
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

    const result = calculateGmicloudCost({ pricing: mockPricing, usage });

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

    const result = calculateGmicloudCost({ pricing: mockPricing, usage });

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

    const result = calculateGmicloudCost({ pricing: mockPricing, usage });

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
      promptTokens: 0.000001,
      completionTokens: 0.000003,
      inputCacheReadTokens: 0.0000005,
      inputCacheWriteTokens: 0,
      request: 0,
    };

    // `CostInputs` declares `cacheReadTokens` as required, but callers that skip strict TS
    // checks (or upstream extraction bugs) may still omit it at runtime.
    const usage = {
      promptTokens: 41,
      completionTokens: 26,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    } as unknown as CostInputs;

    const usageWithExplicitZero = {
      ...usage,
      cacheReadTokens: 0,
    };

    const result = calculateGmicloudCost({ pricing: mockPricing, usage });
    const resultWithExplicitZero = calculateGmicloudCost({
      pricing: mockPricing,
      usage: usageWithExplicitZero,
    });

    expect(result).toEqual(resultWithExplicitZero);
    // Prompt: 0.000001 * 1e9 * 41 = 41,000 nanos
    // Completion: 0.000003 * 1e9 * 26 = 78,000 nanos
    // Cache read defaults to 0 tokens, so cache read cost is 0.
    // Total: 41,000 + 78,000 = 119,000 nanos
    expect(result).toEqual({
      amount: 119000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should default reasoningTokens to 0 when omitted from usage (defensive fallback for non-strict callers)', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.0000002,
      completionTokens: 0.0000008,
      inputCacheReadTokens: 0.0000001,
      request: 0,
    };

    // `CostInputs` declares `reasoningTokens` as required, but callers that skip strict TS
    // checks (or upstream extraction bugs) may still omit it at runtime.
    const usage = {
      promptTokens: 19,
      completionTokens: 158,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    } as unknown as CostInputs;

    const usageWithExplicitZero = {
      ...usage,
      reasoningTokens: 0,
    };

    const result = calculateGmicloudCost({ pricing: mockPricing, usage });
    const resultWithExplicitZero = calculateGmicloudCost({
      pricing: mockPricing,
      usage: usageWithExplicitZero,
    });

    expect(result).toEqual(resultWithExplicitZero);
    // Prompt: 0.0000002 * 1e9 * 19 = 3,800 nanos
    // Completion: 0.0000008 * 1e9 * 158 = 126,400 nanos
    // Reasoning defaults to 0 tokens, so no tokens are shifted from completion to reasoning.
    // Total: 3,800 + 126,400 = 130,200 nanos
    expect(result).toEqual({
      amount: 130200,
      unit: 'nanos',
      currency: 'USD',
    });
  });
});
