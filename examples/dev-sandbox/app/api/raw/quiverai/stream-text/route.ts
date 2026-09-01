import { UIMessage, convertToModelMessages, streamText } from 'ai';
import { quiverai } from '@ai-sdk/quiverai';

export async function POST() {
  try {
    const messages: UIMessage[] = [
      {
        id: 'test-stream-1',
        role: 'user',
        parts: [{ type: 'text', text: 'What is the capital of Sweden?' }],
      },
    ];

    const result = await streamText({
      // @ts-ignore
      model: quiverai.languageModel('default'),

            messages: await convertToModelMessages(messages),
    });

    return (result as any).toDataStreamResponse ? (result as any).toDataStreamResponse() : (result as any).toTextStreamResponse();
  } catch (error) {
    console.error('Stream Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
