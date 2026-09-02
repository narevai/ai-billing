import {
  UIMessage,
  convertToModelMessages,
  generateText,
} from 'ai';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';

const amazonBedrock = createAmazonBedrock({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.AWS_BEARER_TOKEN_BEDROCK,
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  region: process.env.AWS_REGION,
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

    const model = 'anthropic.claude-3-haiku-20240307-v1:0';

    const result = await generateText({
      model: amazonBedrock(model),
      messages: await convertToModelMessages(messages),
    });

    return Response.json(result);
  } catch (error) {
    console.error('Generate Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
