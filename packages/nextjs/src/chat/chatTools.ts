import type { ToolSet } from 'ai';

export interface ChatToolsConfig {
  tools: ToolSet;
  maxSteps?: number;
}

let _config: ChatToolsConfig | undefined;

/** Registers tools and step limit for the chat server action. Call this at module level before any chat requests. */
export function configureChatTools<T extends ToolSet>(config: {
  tools: T;
  maxSteps?: number;
}): void {
  _config = config as ChatToolsConfig;
}

/** Returns the currently registered chat tools configuration, or undefined if none was set. */
export function getChatToolsConfig(): ChatToolsConfig | undefined {
  return _config;
}
