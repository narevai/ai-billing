import { UIMessage, convertToModelMessages, generateText } from 'ai';
import { minimax } from '@ai-sdk/minimax';

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
      
      model: minimax('abab6.5-chat') as unknown as import('ai').LanguageModel,

            messages: await convertToModelMessages(messages),
    });

    return Response.json(result);
  } catch (error) {
    console.error('Generate Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
