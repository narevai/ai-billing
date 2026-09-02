import {
  UIMessage,
  convertToModelMessages,
  streamText,
} from 'ai';
import { createZai } from '@ai-sdk/zai';

const zai = createZai({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.ZAI_API_KEY,
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

  const model = 'glm-5.3';

  const result = streamText({
    model: zai(model),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
