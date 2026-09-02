import {
  UIMessage,
  convertToModelMessages,
  generateText,
} from 'ai';
import { createMoonshotAI } from '@ai-sdk/moonshotai';

const moonshotai = createMoonshotAI({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.MOONSHOT_API_KEY,
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

    const model = 'kimi-k3';

    const result = await generateText({
      model: moonshotai(model),
      messages: await convertToModelMessages(messages),
    });

    return Response.json(result);
  } catch (error) {
    console.error('Generate Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
