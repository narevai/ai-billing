import { UIMessage, convertToModelMessages, streamText } from 'ai';
import { createCohere } from '@ai-sdk/cohere';

const cohere = createCohere({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.COHERE_API_KEY,
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

  const model = 'command-r-plus';

  const result = streamText({
    model: cohere(model),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
