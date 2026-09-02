import {
  UIMessage,
  convertToModelMessages,
  generateText,
} from 'ai';
import { createFireworks } from '@ai-sdk/fireworks';

const fireworks = createFireworks({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.FIREWORKS_API_KEY,
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

    const model = 'accounts/fireworks/models/deepseek-v3';

    const result = await generateText({
      model: fireworks(model),
      messages: await convertToModelMessages(messages),
    });

    return Response.json(result);
  } catch (error) {
    console.error('Generate Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
