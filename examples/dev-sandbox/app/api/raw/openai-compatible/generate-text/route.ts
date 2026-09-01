import { UIMessage, convertToModelMessages, generateText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const provider = createOpenAICompatible({
  name: 'openai-compatible', baseURL: 'https://api.openai.com/v1',
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
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
      
      model: provider('gpt-3.5-turbo') as unknown as import('ai').LanguageModel,

            messages: await convertToModelMessages(messages),
    });

    return Response.json(result);
  } catch (error) {
    console.error('Generate Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
