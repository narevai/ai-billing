import { describe, it, expect } from 'vitest';
import { calculatePerplexityCost } from './calculate-perplexity-cost.js';
import type { ModelPricing } from '@ai-billing/types';

describe('calculatePerplexityCost', () => {
  it('should return undefined if no pricing is provided', () => {
    const result = calculatePerplexityCost({
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

    const result = calculatePerplexityCost({ pricing: mockPricing, usage });

    // Prompt: 0.000001 * 1e9 * 41 = 41,000 nanos
    // Completion: 0.000003 * 1e9 * 26 = 78,000 nanos
    // Total: 119,000 nanos
    expect(result).toEqual({
      amount: 119000,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should calculate cost for the captured sample Perplexity generate-text usage (prompt_tokens: 7, completion_tokens: 19) using a mock pricing table (not Perplexity\'s own real-world rates)', () => {
    // NOTE: this deliberately uses a mock pricing table, not Perplexity's real sonar-pro rates. The
    // captured issue sample's own `usage.raw.cost.total_cost` of $0.00631 reflects Perplexity's real
    // per-token/per-request rates, which this test's mock table need not (and does not) match.
    const mockPricing: ModelPricing = {
      promptTokens: 0.0000002,
      completionTokens: 0.0000006,
      request: 0,
    };

    const usage = {
      promptTokens: 7,
      completionTokens: 19,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    };

    const result = calculatePerplexityCost({ pricing: mockPricing, usage });

    // Prompt: 0.0000002 * 1e9 * 7 = 1,400 nanos
    // Completion: 0.0000006 * 1e9 * 19 = 11,400 nanos
    // Total: 1,400 + 11,400 = 12,800 nanos
    expect(result).toEqual({
      amount: 12800,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should price reasoning tokens using internalReasoningTokens when configured (sonar-reasoning-pro / sonar-deep-research style usage)', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.0000003,
      completionTokens: 0.0000005,
      internalReasoningTokens: 0.000001,
      request: 0,
    };

    const usage = {
      promptTokens: 22,
      completionTokens: 289,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 227,
    };

    const result = calculatePerplexityCost({ pricing: mockPricing, usage });

    // Prompt: 0.0000003 * 1e9 * 22 = 6,600 nanos
    // Completion: 0.0000005 * 1e9 * 289 = 144,500 nanos
    // Reasoning: 0.000001 * 1e9 * 227 = 227,000 nanos
    // Total: 6,600 + 144,500 + 227,000 = 378,100 nanos
    expect(result).toEqual({
      amount: 378100,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should fall back to the completion rate for reasoning tokens when internalReasoningTokens is not configured', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.0000003,
      completionTokens: 0.0000005,
      request: 0,
    };

    const usage = {
      promptTokens: 22,
      completionTokens: 289,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 227,
    };

    const result = calculatePerplexityCost({ pricing: mockPricing, usage });

    // Prompt: 0.0000003 * 1e9 * 22 = 6,600 nanos
    // Completion: 0.0000005 * 1e9 * 289 = 144,500 nanos
    // Reasoning (falls back to completion rate): 0.0000005 * 1e9 * 227 = 113,500 nanos
    // Total: 6,600 + 144,500 + 113,500 = 264,600 nanos
    expect(result).toEqual({
      amount: 264600,
      unit: 'nanos',
      currency: 'USD',
    });
  });

  it('should add the flat request fee exactly once, regardless of token counts', () => {
    const mockPricing: ModelPricing = {
      promptTokens: 0.0000001,
      completionTokens: 0.0000002,
      request: 0.00001,
    };

    const lowUsage = {
      promptTokens: 5,
      completionTokens: 5,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    };

    const highUsage = {
      promptTokens: 500,
      completionTokens: 500,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    };

    const lowResult = calculatePerplexityCost({
      pricing: mockPricing,
      usage: lowUsage,
    });
    const highResult = calculatePerplexityCost({
      pricing: mockPricing,
      usage: highUsage,
    });

    // Low usage — Prompt: 0.0000001 * 1e9 * 5 = 500 nanos
    //             Completion: 0.0000002 * 1e9 * 5 = 1,000 nanos
    //             Request (flat, once): 0.00001 * 1e9 = 10,000 nanos
    //             Total: 500 + 1,000 + 10,000 = 11,500 nanos
    expect(lowResult).toEqual({
      amount: 11500,
      unit: 'nanos',
      currency: 'USD',
    });

    // High usage — Prompt: 0.0000001 * 1e9 * 500 = 50,000 nanos
    //              Completion: 0.0000002 * 1e9 * 500 = 100,000 nanos
    //              Request (flat, once — same as low usage): 0.00001 * 1e9 = 10,000 nanos
    //              Total: 50,000 + 100,000 + 10,000 = 160,000 nanos
    expect(highResult).toEqual({
      amount: 160000,
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

    const result = calculatePerplexityCost({ pricing: mockPricing, usage });

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

    const result = calculatePerplexityCost({ pricing: mockPricing, usage });

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
