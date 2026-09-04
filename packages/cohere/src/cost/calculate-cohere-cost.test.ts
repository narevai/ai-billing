import { describe, it, expect } from 'vitest';
import { calculateCohereCost } from './calculate-cohere-cost.js';
import type { ModelPricing } from '@ai-billing/types';

describe('calculateCohereCost', () => {
  it('should return undefined if no pricing is provided', () => {
    const result = calculateCohereCost({
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

  it('should bill only the billed_units token counts and not over-bill for cached tokens (captured command-r-08-2024 payload)', () => {
    // Captured raw usage: billed_units.{input_tokens: 7, output_tokens: 7}, tokens.{input_tokens: 207,
    // output_tokens: 8}, cached_tokens: 192. The middleware feeds promptTokens/completionTokens from
    // billed_units (7/7), and cacheReadTokens from cached_tokens (192) purely for observability.
    const mockPricing: ModelPricing = {
      promptTokens: 0.15 / 1_000_000,
      completionTokens: 0.6 / 1_000_000,
      request: 0,
    };

    const usage = {
      promptTokens: 7,
      completionTokens: 7,
      cacheReadTokens: 192,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    };

    const result = calculateCohereCost({ pricing: mockPricing, usage });

    // Prompt: 0.15e-6 * 1e9 * 7 = 1,050 nanos
    // Completion: 0.6e-6 * 1e9 * 7 = 4,200 nanos
    // Cache read: 0 (inputCacheReadTokens unset) -- proves no over-billing from the 192 cached tokens
    // Total: 5,250 nanos
    expect(result).toEqual({
      amount: 5250,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should bill cache-read tokens as an opt-in additive line item when inputCacheReadTokens is set', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.15 / 1_000_000,
      completionTokens: 0.6 / 1_000_000,
      inputCacheReadTokens: 0.0000001,
      request: 0,
    };

    const usage = {
      promptTokens: 7,
      completionTokens: 7,
      cacheReadTokens: 192,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    };

    const result = calculateCohereCost({ pricing: mockPricing, usage });

    // Prompt: 0.15e-6 * 1e9 * 7 = 1,050 nanos
    // Completion: 0.6e-6 * 1e9 * 7 = 4,200 nanos
    // Cache read: 0.0000001 * 1e9 * 192 = 19,200 nanos
    // Total: 1,050 + 4,200 + 19,200 = 24,450 nanos
    expect(result).toEqual({
      amount: 24450,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should not subtract cache/reasoning tokens from prompt/completion totals (additive-only, unlike Mistral)', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.0000003,
      completionTokens: 0.0000005,
      inputCacheReadTokens: 0.000000075,
      internalReasoningTokens: 0.0000005,
      request: 0,
    };

    const usage = {
      promptTokens: 22,
      completionTokens: 289,
      cacheReadTokens: 4,
      cacheWriteTokens: 0,
      reasoningTokens: 227,
    };

    const result = calculateCohereCost({ pricing: mockPricing, usage });

    // Prompt (no subtraction): 0.0000003 * 1e9 * 22 = 6,600 nanos
    // Completion (no subtraction): 0.0000005 * 1e9 * 289 = 144,500 nanos
    // Cache read: 0.000000075 * 1e9 * 4 = 300 nanos
    // Reasoning: 0.0000005 * 1e9 * 227 = 113,500 nanos
    // Total: 6,600 + 144,500 + 300 + 113,500 = 264,900 nanos
    expect(result).toEqual({
      amount: 264900,
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

    const result = calculateCohereCost({ pricing: mockPricing, usage });

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

    const result = calculateCohereCost({ pricing: mockPricing, usage });

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

  it('should return an all-zero cost when usage is entirely zero', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.000001,
      completionTokens: 0.000003,
      request: 0,
    };

    const usage = {
      promptTokens: 0,
      completionTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    };

    const result = calculateCohereCost({ pricing: mockPricing, usage });

    expect(result).toEqual({
      amount: 0,
      unit: 'nanos',
      currency: 'USD',
    });
  });
});
