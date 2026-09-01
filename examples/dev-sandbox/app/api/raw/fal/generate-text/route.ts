import { UIMessage, convertToModelMessages, generateText } from 'ai';
import { fal } from '@ai-sdk/fal';

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
      model: fal.languageModel('fal-ai/fast-sdxl'),

            messages: await convertToModelMessages(messages),
    });

    return Response.json(result);
  } catch (error) {
    console.error('Generate Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
