export const DEFAULT_CHAT_MODEL = 'gpt-5';

export const titleModel = {
  id: 'gpt-4o-mini',
  name: 'GPT-4o Mini',
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
    name: 'GPT-5',
    provider: 'openai',
    description: 'Most capable model with tool use and vision',
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    provider: 'openai',
    description: 'Fast and affordable model with tool use',
  },
  {
    id: 'gpt-5-nano',
    name: 'GPT-5 Nano',
    provider: 'openai',
    description: 'Fastest model for simple tasks',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'High-intelligence multimodal model',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Affordable and fast model for everyday tasks',
  },
  {
    id: 'o4-mini',
    name: 'o4 Mini',
    provider: 'openai',
    description: 'Reasoning model for complex problems',
    reasoningEffort: 'low',
  },
  {
    id: 'o3',
    name: 'o3',
    provider: 'openai',
    description: 'Most capable reasoning model',
    reasoningEffort: 'medium',
  },
  {
    id: 'o3-mini',
    name: 'o3 Mini',
    provider: 'openai',
    description: 'Fast reasoning model',
    reasoningEffort: 'low',
  },
];

export function getCapabilities(): Record<string, ModelCapabilities> {
  return {
    'gpt-5': { tools: true, vision: true, reasoning: false },
    'gpt-5-mini': { tools: true, vision: true, reasoning: false },
    'gpt-5-nano': { tools: true, vision: false, reasoning: false },
    'gpt-4o': { tools: true, vision: true, reasoning: false },
    'gpt-4o-mini': { tools: true, vision: true, reasoning: false },
    'o4-mini': { tools: false, vision: false, reasoning: true },
    o3: { tools: false, vision: false, reasoning: true },
    'o3-mini': { tools: false, vision: false, reasoning: true },
  };
}

export const isDemo = process.env.IS_DEMO === '1';

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
