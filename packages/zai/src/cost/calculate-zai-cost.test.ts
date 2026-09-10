import { describe, it, expect } from 'vitest';
import { calculateZaiCost } from './calculate-zai-cost.js';
import type { ModelPricing, CostInputs } from '@ai-billing/types';

describe('calculateZaiCost', () => {
  it('should return undefined if no pricing is provided', () => {
    const result = calculateZaiCost({
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

    const result = calculateZaiCost({ pricing: mockPricing, usage });

    // Prompt: 0.000001 * 1e9 * 41 = 41,000 nanos
    // Completion: 0.000003 * 1e9 * 26 = 78,000 nanos
    // Total: 119,000 nanos
    expect(result).toEqual({
      amount: 119000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should calculate cost for the captured Z.ai (GLM-5.3) generate-text usage (prompt_tokens: 19, completion_tokens: 215, reasoning_tokens: 173, cached_tokens: 0)', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 1.4 / 1_000_000, // $1.40 per 1M tokens
      completionTokens: 4.4 / 1_000_000, // $4.40 per 1M tokens
      inputCacheReadTokens: 0.26 / 1_000_000, // $0.26 per 1M tokens
    };

    const usage = {
      promptTokens: 19,
      completionTokens: 215,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 173,
    };

    const result = calculateZaiCost({ pricing: mockPricing, usage });

    // Prompt: (19 - 0) * 1.4/1e6 * 1e9 = 26,600 nanos
    // Completion: 215 * 4.4/1e6 * 1e9 = 946,000 nanos (reasoningTokens is not read; the full
    // completion_tokens total, which already includes reasoning tokens, is billed once)
    // Cache read: 0
    // Total: 26,600 + 946,000 = 972,600 nanos
    expect(result).toEqual({
      amount: 972600,
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

    const result = calculateZaiCost({ pricing: mockPricing, usage });

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

  it('should bill completionTokens in full at the completion rate, unaffected by reasoningTokens (reasoningTokens <= completionTokens)', () => {
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

    const result = calculateZaiCost({ pricing: mockPricing, usage });

    // Prompt: 0.0000003 * 1e9 * (22 - 4) = 5,400 nanos
    // Completion: 0.0000005 * 1e9 * 289 = 144,500 nanos (reasoningTokens, 227, is not read; it is
    // already a subset of the 289 completion_tokens billed here)
    // Cache read: 0.000000075 * 1e9 * 4 = 300 nanos
    // Total: 5,400 + 144,500 + 300 = 150,200 nanos
    expect(result).toEqual({
      amount: 150200,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should bill completionTokens in full at the completion rate, without overcharging, when reasoningTokens exceeds completionTokens', () => {
    // Regression test for https://github.com/narevai/ai-billing/issues/324 (Issue 2): reasoningTokens
    // can legitimately exceed completionTokens when the provider double-reports the same tokens in
    // both `completion_tokens_details.reasoning_tokens` and the top-level `completion_tokens` field
    // with slightly different rounding/streaming semantics. The output bucket must remain
    // `completionTokens * completionRate` regardless — it must never grow past that because
    // reasoningTokens is larger than completionTokens.
    const mockPricing: ModelPricing = {
      promptTokens: 2e-7,
      completionTokens: 1.1e-6,
      inputCacheReadTokens: 3e-8,
    };

    const usage = {
      promptTokens: 20,
      completionTokens: 185,
      reasoningTokens: 187,
      cacheReadTokens: 4,
      cacheWriteTokens: 0,
    };

    const result = calculateZaiCost({ pricing: mockPricing, usage });

    // Prompt: 2e-7 * 1e9 * (20 - 4) = 3,200 nanos
    // Cache read: 3e-8 * 1e9 * 4 = 120 nanos
    // Completion: 1.1e-6 * 1e9 * 185 = 203,500 nanos (NOT 185 * ... via reasoningTokens=187, which
    // was the pre-fix overcharge of 209,020 nanos)
    // Total: 3,200 + 120 + 203,500 = 206,820 nanos
    expect(result).toEqual({
      amount: 206820,
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

    const result = calculateZaiCost({ pricing: mockPricing, usage });

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

    const result = calculateZaiCost({ pricing: mockPricing, usage });

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

    const result = calculateZaiCost({ pricing: mockPricing, usage });
    const resultWithExplicitZero = calculateZaiCost({
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

  it('should never let reasoningTokens affect cost, whether omitted, zero, below completionTokens, or above completionTokens', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.0000002,
      completionTokens: 0.0000008,
      inputCacheReadTokens: 0.0000001,
      request: 0,
    };

    const baseUsage = {
      promptTokens: 19,
      completionTokens: 158,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    };

    // `CostInputs` declares `reasoningTokens` as required, but callers that skip strict TS checks
    // (or upstream extraction bugs) may still omit it at runtime — and since the calculator no
    // longer reads `reasoningTokens` at all, omitting it must behave identically to every other
    // value.
    const omitted = baseUsage as unknown as CostInputs;
    const zero = { ...baseUsage, reasoningTokens: 0 };
    const belowCompletionTokens = { ...baseUsage, reasoningTokens: 100 };
    const aboveCompletionTokens = { ...baseUsage, reasoningTokens: 400 };

    const results = [
      omitted,
      zero,
      belowCompletionTokens,
      aboveCompletionTokens,
    ].map(usage => calculateZaiCost({ pricing: mockPricing, usage }));

    // Prompt: 0.0000002 * 1e9 * 19 = 3,800 nanos
    // Completion: 0.0000008 * 1e9 * 158 = 126,400 nanos
    // reasoningTokens is never read by the cost formula, so every variant above yields the same
    // total: 3,800 + 126,400 = 130,200 nanos.
    for (const result of results) {
      expect(result).toEqual({
        amount: 130200,
        unit: 'nanos',
        currency: 'USD',
      });
    }
  });
});
