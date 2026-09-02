import {
  UIMessage,
  convertToModelMessages,
  generateText,
} from 'ai';
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
  try {
    const messages: UIMessage[] = [
      {
        id: 'test-gen-1',
        role: 'user',
        parts: [{ type: 'text', text: 'What is the capital of Sweden?' }],
      },
    ];

    const model = 'claude-sonnet-4-6';

    const result = await generateText({
      model: anthropicAws(model),
      messages: await convertToModelMessages(messages),
    });

    return Response.json(result);
  } catch (error) {
    console.error('Generate Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
