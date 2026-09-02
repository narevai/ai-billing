import { UIMessage, convertToModelMessages, generateText } from 'ai';
import { createAzure } from '@ai-sdk/azure';

const azure = createAzure({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.AZURE_API_KEY,
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  resourceName: process.env.AZURE_RESOURCE_NAME,
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

    const model = 'gpt-4o';

    const result = await generateText({
      model: azure(model),
      messages: await convertToModelMessages(messages),
    });

    return Response.json(result);
  } catch (error) {
    console.error('Generate Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
