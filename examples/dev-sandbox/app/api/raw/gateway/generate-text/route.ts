import { UIMessage, convertToModelMessages, generateText } from 'ai';
import { createGateway } from '@ai-sdk/gateway';

const provider = createGateway({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.AI_GATEWAY_API_KEY,
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
      model: provider('openai:gpt-3.5-turbo'),

            messages: await convertToModelMessages(messages),
    });

    return Response.json(result);
  } catch (error) {
    console.error('Generate Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
