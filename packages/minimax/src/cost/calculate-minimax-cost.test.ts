import { describe, it, expect } from 'vitest';
import { calculateMinimaxCost } from './calculate-minimax-cost.js';
import type { ModelPricing } from '@ai-billing/core';

describe('calculateMinimaxCost', () => {
  it('should return undefined if no pricing is provided', () => {
    const result = calculateMinimaxCost({
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
      request: 0,
    };

    const usage = {
      promptTokens: 41,
      completionTokens: 26,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    };

    const result = calculateMinimaxCost({ pricing: mockPricing, usage });

    // Prompt: 0.000001 * 1e9 * 41 = 41,000 nanos
    // Completion: 0.000003 * 1e9 * 26 = 78,000 nanos
    // Total: 119,000 nanos
    expect(result).toEqual({
      amount: 119000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should handle reasoning tokens correctly', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.000001,
      completionTokens: 0.000003,
      internalReasoningTokens: 0.000003,
      request: 0,
    };

    const usage = {
      promptTokens: 10,
      completionTokens: 5,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 20,
    };

    const result = calculateMinimaxCost({ pricing: mockPricing, usage });

    // Prompt: 0.000001 * 1e9 * 10 = 10,000 nanos
    // Completion: 0.000003 * 1e9 * 5 = 15,000 nanos
    // Reasoning: 0.000003 * 1e9 * 20 = 60,000 nanos
    // Total: 85,000 nanos
    expect(result).toEqual({
      amount: 85000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should fallback to completion rate for reasoning when internalReasoningTokens is undefined', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.000001,
      completionTokens: 0.000003,
    };

    const usage = {
      promptTokens: 0,
      completionTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 10,
    };

    const result = calculateMinimaxCost({ pricing: mockPricing, usage });

    // Reasoning: 0.000003 * 1e9 * 10 = 30,000 nanos
    expect(result).toEqual({
      amount: 30000,
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

    const result = calculateMinimaxCost({ pricing: mockPricing, usage });

    // Gross: 0.000001 * 1e9 * 1000 + 0.000002 * 1e9 * 500 = 2,000,000 nanos
    // After 10% discount: 1,800,000 nanos
    expect(result).toEqual({
      amount: 1800000,
      unit: 'nanos',
      currency: 'USD',
    });
  });
});
