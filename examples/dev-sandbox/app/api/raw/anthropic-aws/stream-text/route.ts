import { UIMessage, convertToModelMessages, streamText } from 'ai';
import { createAnthropicAws } from '@ai-sdk/anthropic-aws';

const anthropicAws = createAnthropicAws({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.ANTHROPIC_AWS_API_KEY,
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  workspaceId: process.env.ANTHROPIC_AWS_WORKSPACE_ID,
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

  const model = 'claude-sonnet-4-6';

  const result = streamText({
    model: anthropicAws(model),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
