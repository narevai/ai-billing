import type { CostInputs, Usage } from '../types/index.js';

export function toUsage(inputs: CostInputs): Usage {
  return {
    inputTokens: inputs.promptTokens,
    outputTokens: inputs.completionTokens,
    cacheReadTokens: inputs.cacheReadTokens,
    cacheWriteTokens: inputs.cacheWriteTokens,
    reasoningTokens: inputs.reasoningTokens,
    webSearchCount: inputs.webSearchCount,
  };
}
