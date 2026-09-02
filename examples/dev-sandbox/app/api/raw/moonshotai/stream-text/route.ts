import {
  UIMessage,
  convertToModelMessages,
  streamText,
} from 'ai';
import { createMoonshotAI } from '@ai-sdk/moonshotai';

const moonshotai = createMoonshotAI({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.MOONSHOT_API_KEY,
});

export async function POST() {
  const messages: UIMessage[] = [
    {
      id: 'test-message-123',
      role: 'user',
      parts: [
        {
          type: 'text',
          text: 'What is the capital of Sweden?',
        },
      ],
    },
  ];

  const model = 'kimi-k3';

  const result = streamText({
    model: moonshotai(model),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
