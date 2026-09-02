import { UIMessage, convertToModelMessages, streamText } from 'ai';
import { createVertex } from '@ai-sdk/google-vertex';

const vertex = createVertex({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  project: process.env.GOOGLE_VERTEX_PROJECT,
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  location: process.env.GOOGLE_VERTEX_LOCATION,
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

  const model = 'gemini-2.5-flash';

  const result = streamText({
    model: vertex(model),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
