import type { CostInputs, Usage } from '@ai-billing/types';

/** Maps {@link CostInputs} token counts to a {@link Usage} object. */
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
