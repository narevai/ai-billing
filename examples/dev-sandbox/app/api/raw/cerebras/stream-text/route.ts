import {
  UIMessage,
  convertToModelMessages,
  streamText,
} from 'ai';
import { createCerebras } from '@ai-sdk/cerebras';

const cerebras = createCerebras({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.CEREBRAS_API_KEY,
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

  const model = 'gpt-oss-120b';

  const result = streamText({
    model: cerebras(model),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
