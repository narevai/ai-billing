import {
  UIMessage,
  convertToModelMessages,
  generateText,
} from 'ai';
import { createVertex } from '@ai-sdk/google-vertex';

const vertex = createVertex({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  project: process.env.GOOGLE_VERTEX_PROJECT,
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  location: process.env.GOOGLE_VERTEX_LOCATION,
});

export async function POST() {
  try {
    const messages: UIMessage[] = [
      {
        id: 'test-gen-1',
        role: 'user',
        parts: [{ type: 'text', text: 'What is the capital of Sweden?' }],
      },
    ];

    const model = 'gemini-2.5-flash';

    const result = await generateText({
      model: vertex(model),
      messages: await convertToModelMessages(messages),
    });

    return Response.json(result);
  } catch (error) {
    console.error('Generate Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
