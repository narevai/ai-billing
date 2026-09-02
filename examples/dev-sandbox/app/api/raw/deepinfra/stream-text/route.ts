import {
  UIMessage,
  convertToModelMessages,
  streamText,
} from 'ai';
import { createDeepInfra } from '@ai-sdk/deepinfra';

const deepInfra = createDeepInfra({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.DEEPINFRA_API_KEY,
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

  const model = 'meta-llama/Llama-3.3-70B-Instruct';

  const result = streamText({
    model: deepInfra(model),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
