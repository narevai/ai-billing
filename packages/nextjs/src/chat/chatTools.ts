import type { ToolSet } from 'ai';

export interface ChatToolsConfig {
  tools: ToolSet;
  maxSteps?: number;
}

let _config: ChatToolsConfig | undefined;

export function configureChatTools(config: ChatToolsConfig): void {
  _config = config;
}

export function getChatToolsConfig(): ChatToolsConfig | undefined {
  return _config;
}
