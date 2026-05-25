import { createChatGateway } from '@ai-billing/nextjs/server';
import type { ChatGateway } from '@ai-billing/nextjs/server';
import { isTestEnvironment } from '@/lib/constants';

let _gwPromise: Promise<ChatGateway | null> | null = null;

async function initGateway(): Promise<ChatGateway | null> {
  if (isTestEnvironment) return null;
  const polarAccessToken = process.env.POLAR_ACCESS_TOKEN;
  if (!polarAccessToken) return null;

  return createChatGateway({});
}

export async function getChatGateway(): Promise<ChatGateway | null> {
  if (!_gwPromise) {
    _gwPromise = initGateway();
  }
  return _gwPromise;
}
