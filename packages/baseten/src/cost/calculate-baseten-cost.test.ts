import { describe, it, expect } from 'vitest';
import { costToNumber } from '@ai-billing/core';
import { calculateBasetenCost } from './calculate-baseten-cost.js';
import type { ModelPricing } from '@ai-billing/types';

const costInUsd = (result: ReturnType<typeof calculateBasetenCost>) =>
  result ? costToNumber(result, 'base') : 0;

describe('calculateBasetenCost', () => {
  it('should return undefined if no pricing is provided', () => {
    const result = calculateBasetenCost({
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

  it('should match narev-web fixture for openai/gpt-oss-120b (free cache hits)', () => {
    const pricing: ModelPricing = {
      promptTokens: 1e-7,
      completionTokens: 5e-7,
      inputCacheReadTokens: 5e-8,
      inputCacheWriteTokens: 0,
      request: 0,
    };

    const result = calculateBasetenCost({
      pricing,
      usage: {
        promptTokens: 93,
        completionTokens: 107,
        cacheReadTokens: 64,
        cacheWriteTokens: 0,
        reasoningTokens: 38,
      },
    });

    expect(costInUsd(result)).toBeCloseTo(0.0000564, 8);
  });

  it('should not bill cache read tokens separately', () => {
    const pricing: ModelPricing = {
      promptTokens: 1e-7,
      completionTokens: 5e-7,
      inputCacheReadTokens: 1e-8,
    };

    const result = calculateBasetenCost({
      pricing,
      usage: {
        promptTokens: 100,
        completionTokens: 0,
        cacheReadTokens: 100,
        cacheWriteTokens: 0,
        reasoningTokens: 0,
      },
    });

    expect(costInUsd(result)).toBeCloseTo(0, 8);
  });

  it('should handle cacheRead=0', () => {
    const pricing: ModelPricing = {
      promptTokens: 1e-7,
      completionTokens: 5e-7,
    };

    const result = calculateBasetenCost({
      pricing,
      usage: {
        promptTokens: 93,
        completionTokens: 107,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        reasoningTokens: 0,
      },
    });

    expect(costInUsd(result)).toBeCloseTo(93 * 1e-7 + 107 * 5e-7, 8);
  });
});
