import type { Meta, StoryObj } from '@storybook/react';
import { ModelSelector, type ModelOption } from '@ai-billing/ui';

const sampleModels: ModelOption[] = [
  { id: 'openai:gpt-5', name: 'gpt-5', provider: 'openai' },
  { id: 'openai:gpt-5-mini', name: 'gpt-5-mini', provider: 'openai' },
  { id: 'openai:gpt-4o', name: 'gpt-4o', provider: 'openai' },
  {
    id: 'anthropic:claude-sonnet-4-20250514',
    name: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
  },
  {
    id: 'anthropic:claude-opus-4-20250514',
    name: 'claude-opus-4-20250514',
    provider: 'anthropic',
  },
  { id: 'google:gemini-2.5-pro', name: 'gemini-2.5-pro', provider: 'google' },
  {
    id: 'google:gemini-2.5-flash',
    name: 'gemini-2.5-flash',
    provider: 'google',
  },
  { id: 'deepseek:deepseek-chat', name: 'deepseek-chat', provider: 'deepseek' },
  {
    id: 'groq:llama-4-scout-17b-16e-instruct',
    name: 'llama-4-scout-17b-16e-instruct',
    provider: 'groq',
  },
  { id: 'xai:grok-3', name: 'grok-3', provider: 'xai' },
];

const meta = {
  title: 'Chat/ModelSelector',
  component: ModelSelector,
  tags: ['autodocs'],
  args: {
    models: sampleModels,
    selectedModelId: 'openai:gpt-5',
    onSelect: () => {},
  },
  argTypes: {
    models: {
      control: 'object',
      description: 'Available model options.',
    },
    selectedModelId: {
      control: 'text',
      description: 'Currently selected model ID.',
    },
    onSelect: {
      description: 'Called when the user picks a different model.',
    },
  },
} satisfies Meta<typeof ModelSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SingleProvider: Story = {
  args: {
    models: sampleModels.filter(m => m.provider === 'openai'),
    selectedModelId: 'openai:gpt-4o',
  },
};

export const NoModelSelected: Story = {
  args: { selectedModelId: '' },
};

export const EmptyModels: Story = {
  args: { models: [], selectedModelId: '' },
};

export const Playground: StoryObj<
  React.ComponentProps<typeof ModelSelector> & {
    radius: string;
  }
> = {
  name: '⚙ Playground',
  args: {
    models: sampleModels,
    selectedModelId: 'openai:gpt-5',
    radius: '0.75rem',
  },
  argTypes: {
    radius: {
      control: { type: 'select' },
      options: ['0', '0.25rem', '0.5rem', '0.75rem', '1rem', '1.5rem', '2rem'],
    },
  },
  render: ({ radius, ...args }) => (
    <div style={{ '--radius': radius } as React.CSSProperties}>
      <ModelSelector {...args} />
    </div>
  ),
};
