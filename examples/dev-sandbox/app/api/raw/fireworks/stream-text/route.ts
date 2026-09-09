import { UIMessage, convertToModelMessages, streamText } from 'ai';
import { createFireworks } from '@ai-sdk/fireworks';

const fireworks = createFireworks({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.FIREWORKS_API_KEY,
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

  const model = 'accounts/fireworks/models/deepseek-v3';

  const result = streamText({
    model: fireworks(model),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
