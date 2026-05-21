import type { Meta, StoryObj } from '@storybook/react';
import { ChatMessage } from '@ai-billing/ui';

const meta = {
  title: 'Chat/ChatMessage',
  component: ChatMessage,
  tags: ['autodocs'],
  args: {
    role: 'user',
    content: 'Hello, how can I help you today?',
  },
  argTypes: {
    role: {
      control: 'radio',
      options: ['user', 'assistant'],
      description: 'Message sender role.',
    },
    content: {
      control: 'text',
      description: 'Message text content.',
    },
  },
} satisfies Meta<typeof ChatMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const User: Story = {
  args: {
    role: 'user',
    content: 'Can you explain quantum computing in simple terms?',
  },
};

export const Assistant: Story = {
  args: {
    role: 'assistant',
    content:
      'Quantum computing uses qubits that can exist in multiple states simultaneously, unlike classical bits which are either 0 or 1. This allows quantum computers to solve certain problems much faster.',
  },
};

export const ShortUserMessage: Story = {
  args: { role: 'user', content: 'Hi!' },
};

export const LongAssistantMessage: Story = {
  args: {
    role: 'assistant',
    content:
      'Here is a detailed explanation with multiple paragraphs.\n\nFirst, let us consider the fundamental principles. Quantum mechanics describes the behavior of particles at the atomic scale. Unlike classical physics, quantum systems exhibit superposition and entanglement.\n\nSecond, the practical implications are significant. Quantum computers could revolutionize cryptography, drug discovery, and optimization problems.\n\nThird, there are still major challenges to overcome, including error correction and decoherence.',
  },
};

export const MultilineCode: Story = {
  args: {
    role: 'assistant',
    content:
      'Here is a simple function:\n\n```typescript\nfunction fibonacci(n: number): number {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}\n```\n\nThis uses recursion to calculate the nth Fibonacci number.',
  },
};

export const Playground: StoryObj<
  React.ComponentProps<typeof ChatMessage> & {
    cardBg: string;
    cardFg: string;
    primaryBg: string;
    primaryFg: string;
    radius: string;
  }
> = {
  name: '⚙ Playground',
  args: {
    role: 'assistant',
    content: 'Customize the theme variables to see how the bubble adapts.',
    cardBg: '',
    cardFg: '',
    primaryBg: '',
    primaryFg: '',
    radius: '0.75rem',
  },
  argTypes: {
    cardBg: { control: 'color', description: 'Assistant bubble background' },
    cardFg: { control: 'color', description: 'Assistant bubble text' },
    primaryBg: { control: 'color', description: 'User bubble background' },
    primaryFg: { control: 'color', description: 'User bubble text' },
    radius: {
      control: { type: 'select' },
      options: ['0', '0.25rem', '0.5rem', '0.75rem', '1rem', '1.5rem', '2rem'],
    },
  },
  render: ({ cardBg, cardFg, primaryBg, primaryFg, radius, ...args }) => {
    const vars: Record<string, string> = { '--radius': radius };
    if (cardBg) vars['--card'] = cardBg;
    if (cardFg) vars['--card-foreground'] = cardFg;
    if (primaryBg) vars['--primary'] = primaryBg;
    if (primaryFg) vars['--primary-foreground'] = primaryFg;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ChatMessage role="user" content="What is TypeScript?" />
        <div style={vars as React.CSSProperties}>
          <ChatMessage {...args} />
        </div>
      </div>
    );
  },
};
