import { UIMessage, convertToModelMessages, generateText } from 'ai';
import { createHuggingFace } from '@ai-sdk/huggingface';

const huggingFace = createHuggingFace({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.HUGGINGFACE_API_KEY,
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

    const model = 'meta-llama/Llama-3.1-8B-Instruct';

    const result = await generateText({
      model: huggingFace(model),
      messages: await convertToModelMessages(messages),
    });

    return Response.json(result);
  } catch (error) {
    console.error('Generate Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
