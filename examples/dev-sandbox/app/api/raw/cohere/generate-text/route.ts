import { UIMessage, convertToModelMessages, generateText } from 'ai';
import { createCohere } from '@ai-sdk/cohere';

const cohere = createCohere({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.COHERE_API_KEY,
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

    const model = 'command-r-plus';

    const result = await generateText({
      model: cohere(model),
      messages: await convertToModelMessages(messages),
    });

    return Response.json(result);
  } catch (error) {
    console.error('Generate Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
