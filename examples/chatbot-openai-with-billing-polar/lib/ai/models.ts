export const DEFAULT_CHAT_MODEL = 'gpt-4.1-mini';

export const titleModel = {
  id: 'gpt-4.1-mini',
  name: 'GPT 4.1 Mini',
  provider: 'openai',
  description: 'Fast model for title generation',
};

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  reasoningEffort?: 'none' | 'minimal' | 'low' | 'medium' | 'high';
};

export const chatModels: ChatModel[] = [
  {
    id: 'gpt-5',
    name: 'GPT 5',
    provider: 'openai',
    description: 'Latest flagship model with tool use and vision',
  },
  {
    id: 'gpt-4o',
    name: 'GPT 4o',
    provider: 'openai',
    description: 'Versatile multimodal model with tool use',
  },
  {
    id: 'gpt-4.1-mini',
    name: 'GPT 4.1 Mini',
    provider: 'openai',
    description: 'Fast and efficient model with tool use',
  },
  {
    id: 'o3-mini',
    name: 'o3 Mini',
    provider: 'openai',
    description: 'Compact reasoning model',
    reasoningEffort: 'low',
  },
  {
    id: 'o4-mini',
    name: 'o4 Mini',
    provider: 'openai',
    description: 'Latest compact reasoning model',
    reasoningEffort: 'low',
  },
];

export function getCapabilities(): Record<string, ModelCapabilities> {
  return {
    'gpt-5': { tools: true, vision: true, reasoning: false },
    'gpt-4o': { tools: true, vision: true, reasoning: false },
    'gpt-4.1-mini': { tools: true, vision: true, reasoning: false },
    'o3-mini': { tools: true, vision: false, reasoning: true },
    'o4-mini': { tools: true, vision: true, reasoning: true },
  };
}

export function getActiveModels(): ChatModel[] {
  return chatModels;
}

export const allowedModelIds = new Set(chatModels.map(m => m.id));

export const modelsByProvider = chatModels.reduce(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  },
  {} as Record<string, ChatModel[]>,
);
