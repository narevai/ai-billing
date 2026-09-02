import { UIMessage, convertToModelMessages, generateText } from 'ai';
import { createDeepInfra } from '@ai-sdk/deepinfra';

const deepInfra = createDeepInfra({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.DEEPINFRA_API_KEY,
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

    const model = 'meta-llama/Llama-3.3-70B-Instruct';

    const result = await generateText({
      model: deepInfra(model),
      messages: await convertToModelMessages(messages),
    });

    return Response.json(result);
  } catch (error) {
    console.error('Generate Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
