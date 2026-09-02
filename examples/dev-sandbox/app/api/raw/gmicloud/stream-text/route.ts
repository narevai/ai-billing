import { UIMessage, convertToModelMessages, streamText } from 'ai';
import { createGmicloud } from '@ai-sdk/gmicloud';

const gmicloud = createGmicloud({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.GMI_CLOUD_APIKEY,
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

  const model = 'deepseek-ai/DeepSeek-V4-Flash-0731';

  const result = streamText({
    model: gmicloud(model),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
