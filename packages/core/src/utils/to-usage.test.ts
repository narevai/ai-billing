import { describe, it, expect } from 'vitest';
import { toUsage } from './to-usage.js';

describe('toUsage', () => {
  it('should map all fields from CostInputs to Usage', () => {
    const result = toUsage({
      promptTokens: 100,
      completionTokens: 50,
      cacheReadTokens: 10,
      cacheWriteTokens: 5,
      reasoningTokens: 20,
      webSearchCount: 3,
    });

    expect(result).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 10,
      cacheWriteTokens: 5,
      reasoningTokens: 20,
      webSearchCount: 3,
    });
  });

  it('should pass through undefined for optional fields when not provided', () => {
    const result = toUsage({
      promptTokens: 10,
      completionTokens: 5,
    });

    expect(result).toEqual({
      inputTokens: 10,
      outputTokens: 5,
      cacheReadTokens: undefined,
      cacheWriteTokens: undefined,
      reasoningTokens: undefined,
      webSearchCount: undefined,
    });
  });
});
