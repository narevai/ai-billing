import {
  UIMessage,
  convertToModelMessages,
  streamText,
} from 'ai';
import { createAzure } from '@ai-sdk/azure';

const azure = createAzure({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.AZURE_API_KEY,
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  resourceName: process.env.AZURE_RESOURCE_NAME,
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

  const model = 'gpt-4o';

  const result = streamText({
    model: azure(model),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
