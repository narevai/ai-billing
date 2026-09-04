import { describe, it, expect } from 'vitest';
import { calculateMoonshotaiCost } from './calculate-moonshotai-cost.js';
import type { ModelPricing } from '@ai-billing/types';

describe('calculateMoonshotaiCost', () => {
  it('should return undefined if no pricing is provided', () => {
    const result = calculateMoonshotaiCost({
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
      promptTokens: 0.000003,
      completionTokens: 0.000015,
      inputCacheReadTokens: 0.0000003,
      internalReasoningTokens: 0.000015,
    };

    const usage = {
      promptTokens: 41,
      completionTokens: 26,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    };

    const result = calculateMoonshotaiCost({ pricing: mockPricing, usage });

    // Prompt: 0.000003 * 1e9 * 41 = 123,000 nanos
    // Completion: 0.000015 * 1e9 * 26 = 390,000 nanos
    // Total: 513,000 nanos
    expect(result).toEqual({
      amount: 513000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should calculate cost for the captured kimi-k3 generate-text usage (prompt_tokens: 92, completion_tokens: 369, reasoning_tokens: 297)', () => {
    // Published kimi-k3 pricing: $3.00/1M prompt, $15.00/1M completion (and reasoning, flat rate),
    // $0.30/1M cache-read.
    const mockPricing: ModelPricing = {
      promptTokens: 3.0 / 1_000_000,
      completionTokens: 15.0 / 1_000_000,
      inputCacheReadTokens: 0.3 / 1_000_000,
      internalReasoningTokens: 15.0 / 1_000_000,
    };

    // completion_tokens (369) includes reasoning_tokens (297); text-only output = 369 - 297 = 72.
    const usage = {
      promptTokens: 92,
      completionTokens: 72,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 297,
    };

    const result = calculateMoonshotaiCost({ pricing: mockPricing, usage });

    // Prompt: (3.0 / 1e6) * 1e9 * 92 = 276,000 nanos
    // Completion (text-only, 72): (15.0 / 1e6) * 1e9 * 72 = 1,080,000 nanos
    // Reasoning (297): (15.0 / 1e6) * 1e9 * 297 = 4,455,000 nanos
    // Cache read: 0
    // Total: 276,000 + 1,080,000 + 4,455,000 = 5,811,000 nanos
    expect(result).toEqual({
      amount: 5811000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should fall back to the completionTokens rate for reasoning cost when internalReasoningTokens is not set', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 3.0 / 1_000_000,
      completionTokens: 15.0 / 1_000_000,
      inputCacheReadTokens: 0.3 / 1_000_000,
      // internalReasoningTokens intentionally omitted.
    };

    const usage = {
      promptTokens: 92,
      completionTokens: 72,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 297,
    };

    const result = calculateMoonshotaiCost({ pricing: mockPricing, usage });

    // Reasoning falls back to completionTokens rate: (15.0 / 1e6) * 1e9 * 297 = 4,455,000 nanos
    // Same total as the explicit internalReasoningTokens case above, since kimi-k3's published rate
    // for reasoning output tokens equals its completion rate.
    expect(result).toEqual({
      amount: 5811000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should deduct cached tokens from prompt correctly', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 3.0 / 1_000_000,
      completionTokens: 15.0 / 1_000_000,
      inputCacheReadTokens: 0.3 / 1_000_000,
      internalReasoningTokens: 15.0 / 1_000_000,
    };

    const usage = {
      promptTokens: 1000, // Total prompt tokens
      completionTokens: 100,
      cacheReadTokens: 400, // Subset of prompt tokens
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    };

    const result = calculateMoonshotaiCost({ pricing: mockPricing, usage });

    // Prompt (non-cached): (1000 - 400) * (3.0 / 1e6) * 1e9 = 1,800,000 nanos
    // Cache read: 400 * (0.3 / 1e6) * 1e9 = 120,000 nanos
    // Completion: 100 * (15.0 / 1e6) * 1e9 = 1,500,000 nanos
    // Total: 1,800,000 + 120,000 + 1,500,000 = 3,420,000 nanos
    expect(result).toEqual({
      amount: 3420000,
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

    const result = calculateMoonshotaiCost({ pricing: mockPricing, usage });

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

    const result = calculateMoonshotaiCost({ pricing: mockPricing, usage });

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
