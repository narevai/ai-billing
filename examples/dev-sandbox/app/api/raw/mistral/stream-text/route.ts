import { UIMessage, convertToModelMessages, streamText } from 'ai';
import { createMistral } from '@ai-sdk/mistral';

const mistral = createMistral({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.MISTRAL_API_KEY,
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

  const model = 'mistral-large-latest';

  const result = streamText({
    model: mistral(model),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
