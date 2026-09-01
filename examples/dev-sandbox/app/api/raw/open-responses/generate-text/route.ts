import { UIMessage, convertToModelMessages, generateText } from 'ai';
import { createOpenResponses } from '@ai-sdk/open-responses';

const provider = createOpenResponses({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  name: 'open-responses', url: 'http://localhost',
  apiKey: process.env.OPEN_RESPONSES_API_KEY,
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

    const result = await generateText({
      // @ts-ignore
      model: provider('llama-3-8b'),

            messages: await convertToModelMessages(messages),
    });

    return Response.json(result);
  } catch (error) {
    console.error('Generate Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
