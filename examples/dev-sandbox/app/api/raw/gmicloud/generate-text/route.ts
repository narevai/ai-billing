import { UIMessage, convertToModelMessages, generateText } from 'ai';
import { createGmicloud } from '@ai-sdk/gmicloud';

const gmicloud = createGmicloud({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.GMI_CLOUD_APIKEY,
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

    const model = 'deepseek-ai/DeepSeek-V4-Flash-0731';

    const result = await generateText({
      model: gmicloud(model),
      messages: await convertToModelMessages(messages),
    });

    return Response.json(result);
  } catch (error) {
    console.error('Generate Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
