import { UIMessage, convertToModelMessages, streamText } from 'ai';
import { createOpenResponses } from '@ai-sdk/open-responses';

const provider = createOpenResponses({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  name: 'open-responses', url: 'http://localhost',
  apiKey: process.env.OPEN_RESPONSES_API_KEY,
});

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
      
      model: provider('llama-3-8b') as unknown as import('ai').LanguageModel,

            messages: await convertToModelMessages(messages),
    });

    return (result as any).toDataStreamResponse ? (result as any).toDataStreamResponse() : (result as any).toTextStreamResponse();
  } catch (error) {
    console.error('Stream Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
