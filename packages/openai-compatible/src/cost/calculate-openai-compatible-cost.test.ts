import { describe, it, expect } from 'vitest';
import { calculateOpenAICompatibleCost } from './calculate-openai-compatible-cost.js';
import type { ModelPricing } from '@ai-billing/core';

describe('calculateOpenAICompatibleCost', () => {
  it('should return undefined if no pricing is provided', () => {
    const result = calculateOpenAICompatibleCost({
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

  it('should calculate basic prompt and completion cost', () => {
    const pricing: ModelPricing = {
      promptTokens: 0.0000002, // $0.20 per 1M
      completionTokens: 0.00000125, // $1.25 per 1M
    };

    const result = calculateOpenAICompatibleCost({
      pricing,
      usage: {
        promptTokens: 17,
        completionTokens: 3,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        reasoningTokens: 0,
      },
    });

    // Prompt: 17 * 200 = 3,400 nanos
    // Completion: 3 * 1,250 = 3,750 nanos
    // Total: 7,150 nanos
    expect(result).toEqual({ amount: 7150, unit: 'nanos', currency: 'USD' });
  });

  it('should price reasoning tokens separately when internalReasoningTokens is set', () => {
    const pricing: ModelPricing = {
      promptTokens: 0.0000002,
      completionTokens: 0.00000125,
      internalReasoningTokens: 0.000005, // $5.00 per 1M
    };

    const result = calculateOpenAICompatibleCost({
      pricing,
      usage: {
        promptTokens: 17,
        completionTokens: 3,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        reasoningTokens: 144,
      },
    });

    // Prompt: 17 * 200 = 3,400 nanos
    // Completion: 3 * 1,250 = 3,750 nanos
    // Reasoning: 144 * 5,000 = 720,000 nanos
    // Total: 727,150 nanos
    expect(result).toEqual({ amount: 727150, unit: 'nanos', currency: 'USD' });
  });

  it('should fallback to completion price for reasoning when internalReasoningTokens is not set', () => {
    const pricing: ModelPricing = {
      promptTokens: 0.0000002,
      completionTokens: 0.00000125,
    };

    const result = calculateOpenAICompatibleCost({
      pricing,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        reasoningTokens: 10,
      },
    });

    // Reasoning: 10 * 1,250 = 12,500 nanos
    expect(result).toEqual({ amount: 12500, unit: 'nanos', currency: 'USD' });
  });

  it('should handle cache read and write tokens', () => {
    const pricing: ModelPricing = {
      promptTokens: 0.0000002,
      completionTokens: 0.000001,
      inputCacheReadTokens: 0.0000001,
      inputCacheWriteTokens: 0.0000002,
    };

    const result = calculateOpenAICompatibleCost({
      pricing,
      usage: {
        promptTokens: 10, // 10 * 200 = 2,000 nanos
        completionTokens: 5, // 5 * 1,000 = 5,000 nanos
        cacheReadTokens: 100, // 100 * 100 = 10,000 nanos
        cacheWriteTokens: 50, // 50 * 200 = 10,000 nanos
        reasoningTokens: 0,
      },
    });

    // Total: 2,000 + 5,000 + 10,000 + 10,000 = 27,000 nanos
    expect(result).toEqual({ amount: 27000, unit: 'nanos', currency: 'USD' });
  });

  it('should bill web search calls when webSearch price is set', () => {
    const pricing: ModelPricing = {
      promptTokens: 0,
      completionTokens: 0,
      webSearch: 0.03, // $0.03 per search = 30,000,000 nanos
    };

    const result = calculateOpenAICompatibleCost({
      pricing,
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

  it('should apply discount correctly', () => {
    const pricing: ModelPricing = {
      promptTokens: 0.0000002,
      completionTokens: 0,
      discount: 0.1, // 10%
    };

    const result = calculateOpenAICompatibleCost({
      pricing,
      usage: {
        promptTokens: 100, // 100 * 200 = 20,000 nanos
        completionTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        reasoningTokens: 0,
      },
    });

    // 20,000 - 10% = 18,000 nanos
    expect(result).toEqual({ amount: 18000, unit: 'nanos', currency: 'USD' });
  });

  it('should include flat request fee', () => {
    const pricing: ModelPricing = {
      promptTokens: 0,
      completionTokens: 0,
      request: 0.01, // $0.01 = 10,000,000 nanos
    };

    const result = calculateOpenAICompatibleCost({
      pricing,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        reasoningTokens: 0,
      },
    });

    expect(result).toEqual({
      amount: 10000000,
      unit: 'nanos',
      currency: 'USD',
    });
  });
});
