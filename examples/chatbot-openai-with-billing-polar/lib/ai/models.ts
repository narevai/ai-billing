export const DEFAULT_CHAT_MODEL = 'gpt-5.4-nano';

export const titleModel = {
  id: 'gpt-5-nano',
  name: 'GPT 5 Nano',
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
    id: 'gpt-5.4-nano',
    name: 'GPT 5.4 Nano',
    provider: 'openai',
    description: 'Fastest and cheapest model with tool use',
  },
  {
    id: 'gpt-5.4-mini',
    name: 'GPT 5.4 Mini',
    provider: 'openai',
    description: 'Balanced speed and capability',
  },
  {
    id: 'gpt-5.1',
    name: 'GPT 5.1',
    provider: 'openai',
    description: 'Powerful general-purpose model',
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT 5 Mini',
    provider: 'openai',
    description: 'Fast and efficient',
  },
  {
    id: 'gpt-5-nano',
    name: 'GPT 5 Nano',
    provider: 'openai',
    description: 'Ultra-fast lightweight model',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT 4o Mini',
    provider: 'openai',
    description: 'Efficient multimodal model',
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT 3.5 Turbo',
    provider: 'openai',
    description: 'Legacy fast model',
  },
];

export function getCapabilities(): Record<string, ModelCapabilities> {
  return {
    'gpt-5.4-nano': { tools: true, vision: true, reasoning: false },
    'gpt-5.4-mini': { tools: true, vision: true, reasoning: false },
    'gpt-5.1': { tools: true, vision: true, reasoning: false },
    'gpt-5-mini': { tools: true, vision: true, reasoning: false },
    'gpt-5-nano': { tools: true, vision: true, reasoning: false },
    'gpt-4o-mini': { tools: true, vision: true, reasoning: false },
    'gpt-3.5-turbo': { tools: true, vision: false, reasoning: false },
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
