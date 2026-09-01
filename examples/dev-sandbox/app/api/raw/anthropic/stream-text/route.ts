import { UIMessage, convertToModelMessages, streamText } from 'ai';
// @ts-ignore
import { createAnthropic } from '@ai-sdk/anthropic';

const provider = createAnthropic({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.ANTHROPIC_API_KEY,
} as any);

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
      model: (provider as any)('dummy-model') as any,
      messages: await convertToModelMessages(messages),
    });

    return (result as any).toDataStreamResponse ? (result as any).toDataStreamResponse() : (result as any).toTextStreamResponse();
  } catch (error) {
    console.error('Stream Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
