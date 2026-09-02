import { describe, it, expect } from 'vitest';
import { calculateMistralCost } from './calculate-mistral-cost.js';
import type { ModelPricing } from '@ai-billing/types';

describe('calculateMistralCost', () => {
  it('should return undefined if no pricing is provided', () => {
    const result = calculateMistralCost({
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

    const result = calculateMistralCost({ pricing: mockPricing, usage });

    // Prompt: 0.000001 * 1e9 * 41 = 41,000 nanos
    // Completion: 0.000003 * 1e9 * 26 = 78,000 nanos
    // Total: 119,000 nanos
    expect(result).toEqual({
      amount: 119000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should calculate cost for the sample Mistral generate-text usage (prompt_tokens: 10, completion_tokens: 52, cached_tokens: 0)', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.0000002,
      completionTokens: 0.0000006,
      inputCacheReadTokens: 0.00000005,
      request: 0,
    };

    const usage = {
      promptTokens: 10,
      completionTokens: 52,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    };

    const result = calculateMistralCost({ pricing: mockPricing, usage });

    // Prompt: 0.0000002 * 1e9 * 10 = 2,000 nanos
    // Completion: 0.0000006 * 1e9 * 52 = 31,200 nanos
    // Total: 33,200 nanos
    expect(result).toEqual({
      amount: 33200,
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

    const result = calculateMistralCost({ pricing: mockPricing, usage });

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

  it('should deduct reasoning tokens from completion tokens correctly (speculative Magistral-style usage)', () => {
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

    const result = calculateMistralCost({ pricing: mockPricing, usage });

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

    const result = calculateMistralCost({ pricing: mockPricing, usage });

    // Gross: 0.000001 * 1e9 * 1000 + 0.000002 * 1e9 * 500 = 2,000,000 nanos
    // After 10% discount: 1,800,000 nanos
    expect(result).toEqual({
      amount: 1800000,
      unit: 'nanos',
      currency: 'USD',
    });
  });
});
