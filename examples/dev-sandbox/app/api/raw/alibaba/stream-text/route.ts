import {
  UIMessage,
  convertToModelMessages,
  streamText,
} from 'ai';
import { createAlibaba } from '@ai-sdk/alibaba';

const alibaba = createAlibaba({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.ALIBABA_API_KEY,
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

  const model = 'qwen-plus';

  const result = streamText({
    model: alibaba(model),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
