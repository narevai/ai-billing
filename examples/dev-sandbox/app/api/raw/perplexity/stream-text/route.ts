import {
  UIMessage,
  convertToModelMessages,
  streamText,
} from 'ai';
import { createPerplexity } from '@ai-sdk/perplexity';

const perplexity = createPerplexity({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.PERPLEXITY_API_KEY,
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

  const model = 'sonar-pro';

  const result = streamText({
    model: perplexity(model),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
