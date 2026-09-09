import { UIMessage, convertToModelMessages, streamText } from 'ai';
import { createHuggingFace } from '@ai-sdk/huggingface';

const huggingFace = createHuggingFace({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.HUGGINGFACE_API_KEY,
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

  const model = 'meta-llama/Llama-3.1-8B-Instruct';

  const result = streamText({
    model: huggingFace(model),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
