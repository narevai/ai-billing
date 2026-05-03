import {
  UIMessage,
  convertToModelMessages,
  generateText,
  wrapLanguageModel,
} from 'ai';
import { createGateway } from 'ai';
import { createGatewayMiddleware } from '@ai-billing/gateway';
import { consoleDestination } from '@ai-billing/core';

const gateway = createGateway({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

const billingMiddleware = createGatewayMiddleware({
  destinations: [consoleDestination()],
});

export async function POST() {
  try {
    const messages: UIMessage[] = [
      {
        id: 'test-gen-1',
        role: 'user',
        parts: [{ type: 'text', text: 'What is the capital of Sweden?' }],
      },
    ];

    const model = 'deepseek/deepseek-v4-pro';

    const wrappedModel = wrapLanguageModel({
      model: gateway(model),
      middleware: billingMiddleware,
    });

    const result = await generateText({
      model: wrappedModel,
      messages: await convertToModelMessages(messages),
    });

    return Response.json(result);
  } catch (error) {
    console.error('Generate Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
