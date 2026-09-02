import { UIMessage, convertToModelMessages, generateText } from 'ai';
import { createTogetherAI } from '@ai-sdk/togetherai';

const togetherai = createTogetherAI({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.TOGETHER_API_KEY,
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

    const model = 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo';

    const result = await generateText({
      model: togetherai(model),
      messages: await convertToModelMessages(messages),
    });

    return Response.json(result);
  } catch (error) {
    console.error('Generate Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
