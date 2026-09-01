import { UIMessage, convertToModelMessages, streamText } from 'ai';
import { createGateway } from '@ai-sdk/gateway';

const provider = createGateway({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.AI_GATEWAY_API_KEY,
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
      
      model: provider('openai:gpt-3.5-turbo') as unknown as import('ai').LanguageModel,

            messages: await convertToModelMessages(messages),
    });

    return (result as any).toDataStreamResponse ? (result as any).toDataStreamResponse() : (result as any).toTextStreamResponse();
  } catch (error) {
    console.error('Stream Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
