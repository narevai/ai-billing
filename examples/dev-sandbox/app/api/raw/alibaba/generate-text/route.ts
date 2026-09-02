import { UIMessage, convertToModelMessages, generateText } from 'ai';
import { createAlibaba } from '@ai-sdk/alibaba';

const alibaba = createAlibaba({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.ALIBABA_API_KEY,
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

    const model = 'qwen-plus';

    const result = await generateText({
      model: alibaba(model),
      messages: await convertToModelMessages(messages),
    });

    return Response.json(result);
  } catch (error) {
    console.error('Generate Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
