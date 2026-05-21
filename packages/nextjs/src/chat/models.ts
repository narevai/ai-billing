import type { ModelOption } from '@ai-billing/ui';

export const DEFAULT_MODELS: Record<string, string[]> = {
  openai: [
    'gpt-5',
    'gpt-5-mini',
    'gpt-5-nano',
    'gpt-4o',
    'gpt-4o-mini',
    'o4-mini',
    'o3',
    'o3-mini',
  ],
  anthropic: [
    'claude-sonnet-4-20250514',
    'claude-opus-4-20250514',
    'claude-3-5-haiku-latest',
  ],
  google: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  groq: [
    'llama-4-scout-17b-16e-instruct',
    'deepseek-r1-distill-llama-70b',
    'mixtral-8x7b-32768',
    'llama-3.3-70b-versatile',
  ],
  xai: ['grok-3', 'grok-3-mini'],
  chutes: ['deepseek-ai/DeepSeek-V3-0324', 'deepseek-ai/DeepSeek-R1'],
  minimax: ['minimax-m1'],
  openrouter: [
    'openai/gpt-4o',
    'anthropic/claude-sonnet-4-20250514',
    'google/gemini-2.5-pro',
    'deepseek/deepseek-chat',
  ],
  gateway: [
    'openai/gpt-5',
    'openai/gpt-5-mini',
    'openai/gpt-5-nano',
    'openai/gpt-4o',
    'anthropic/claude-sonnet-4-20250514',
    'google/gemini-2.5-pro',
  ],
};

/**
 * Converts a provider ID and model ID list into {@link ModelOption} objects
 * with composite IDs like `{provider}:{model}`.
 *
 * @param providerId - The provider identifier (e.g. "openai")
 * @param models - The list of model IDs for that provider
 */
export function buildModelOptions(
  providerId: string,
  models: string[],
): ModelOption[] {
  return models.map(modelId => ({
    id: `${providerId}:${modelId}`,
    name: modelId,
    provider: providerId,
  }));
}
