import { UIMessage, convertToModelMessages, generateText } from 'ai';
import { anthropicAws } from '@ai-sdk/anthropic-aws';

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
      
      model: anthropicAws('anthropic.claude-3-haiku-20240307-v1:0') as unknown as import('ai').LanguageModel,

            messages: await convertToModelMessages(messages),
    });

    return Response.json(result);
  } catch (error) {
    console.error('Generate Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
