import { UIMessage, convertToModelMessages, streamText } from 'ai';
import { createTogetherAI } from '@ai-sdk/togetherai';

const togetherai = createTogetherAI({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.TOGETHER_API_KEY,
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

  const model = 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo';

  const result = streamText({
    model: togetherai(model),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
