import { UIMessage, convertToModelMessages, generateText } from 'ai';
// @ts-ignore
import { createMistral } from '@ai-sdk/mistral';

const provider = createMistral({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.MISTRAL_API_KEY,
} as any);

export async function POST() {
  try {
    const messages: UIMessage[] = [
      {
        id: 'test-gen-1',
        role: 'user',
        parts: [{ type: 'text', text: 'What is the capital of Sweden?' }],
      },
    ];

    const result = await generateText({
      model: (provider as any)('dummy-model') as any,
      messages: await convertToModelMessages(messages),
    });

    return Response.json(result);
  } catch (error) {
    console.error('Generate Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
