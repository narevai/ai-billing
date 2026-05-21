import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ChatMessages, ChatMessage } from '@ai-billing/ui';

const meta = {
  title: 'Chat/ChatMessages',
  component: ChatMessages,
  tags: ['autodocs'],
  args: {
    emptyMessage: 'No messages yet. Start a conversation!',
    isLoading: false,
  },
  argTypes: {
    children: { description: 'ChatMessage components to display.' },
    isLoading: {
      control: 'boolean',
      description: 'Shows loading dots at the bottom.',
    },
    emptyMessage: {
      control: 'text',
      description: 'Text shown when there are no children and not loading.',
    },
  },
} satisfies Meta<typeof ChatMessages>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Loading: Story = {
  args: { isLoading: true },
};

export const WithMessages: Story = {
  render: () => (
    <ChatMessages>
      <ChatMessage role="user" content="What is quantum computing?" />
      <ChatMessage
        role="assistant"
        content="Quantum computing harnesses quantum mechanics principles like superposition and entanglement to process information in fundamentally new ways."
      />
    </ChatMessages>
  ),
};

export const Conversation: Story = {
  render: () => (
    <ChatMessages>
      <ChatMessage role="user" content="Hi! Can you help me with TypeScript?" />
      <ChatMessage
        role="assistant"
        content="Of course! What would you like to know about TypeScript?"
      />
      <ChatMessage role="user" content="How do I define a generic function?" />
      <ChatMessage
        role="assistant"
        content={
          'You can define a generic function like this:\n\n```typescript\nfunction identity<T>(arg: T): T {\n  return arg;\n}\n```\n\nThe `<T>` syntax declares a type parameter that TypeScript infers from the argument.'
        }
      />
    </ChatMessages>
  ),
};

export const StreamingMessages: Story = {
  render: () => (
    <ChatMessages isLoading>
      <ChatMessage role="user" content="Write a haiku about coding." />
      <ChatMessage
        role="assistant"
        content="Fingers touch the keys,\nLogic flows like mountain streams,\nBugs hide in the night."
      />
    </ChatMessages>
  ),
};

export const Playground: StoryObj<
  React.ComponentProps<typeof ChatMessages> & {
    messageCount: number;
    emptyMessage: string;
    loading: boolean;
  }
> = {
  name: '⚙ Playground',
  args: {
    messageCount: 2,
    emptyMessage: 'No messages yet. Start a conversation!',
    loading: false,
  },
  argTypes: {
    messageCount: {
      control: { type: 'range', min: 0, max: 10, step: 1 },
      description: 'Number of message pairs to show',
    },
    loading: { control: 'boolean' },
  },
  render: ({ messageCount, loading, emptyMessage }) => {
    const pairs = Array.from({ length: messageCount }, (_, i) => (
      <React.Fragment key={i}>
        <ChatMessage role="user" content={`Question ${i + 1}`} />
        <ChatMessage
          role="assistant"
          content={`This is the answer to question ${i + 1}. It may contain multiple lines or even code snippets.`}
        />
      </React.Fragment>
    ));
    return (
      <ChatMessages isLoading={loading} emptyMessage={emptyMessage}>
        {pairs}
      </ChatMessages>
    );
  },
};
