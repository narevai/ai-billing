import { UIMessage, convertToModelMessages, streamText } from 'ai';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';

const amazonBedrock = createAmazonBedrock({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.AWS_BEARER_TOKEN_BEDROCK,
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  region: process.env.AWS_REGION,
});

export async function POST() {
  const messages: UIMessage[] = [
    {
      id: 'test-message-123',
      role: 'user',
      parts: [
        {
          type: 'text',
          text: 'What is the capital of Sweden?',
        },
      ],
    },
  ];

  const model = 'anthropic.claude-3-haiku-20240307-v1:0';

  const result = streamText({
    model: amazonBedrock(model),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
