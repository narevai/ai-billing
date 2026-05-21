import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ChatInput, ModelSelector, type ModelOption } from '@ai-billing/ui';

const sampleModels: ModelOption[] = [
  { id: 'openai/gpt-4o', name: 'gpt-4o', provider: 'openai' },
  { id: 'openai/gpt-4o-mini', name: 'gpt-4o-mini', provider: 'openai' },
  {
    id: 'anthropic/claude-sonnet-4-20250514',
    name: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
  },
  {
    id: 'anthropic/claude-opus-4-20250514',
    name: 'claude-opus-4-20250514',
    provider: 'anthropic',
  },
  { id: 'google/gemini-2.5-pro', name: 'gemini-2.5-pro', provider: 'google' },
  {
    id: 'google/gemini-2.5-flash',
    name: 'gemini-2.5-flash',
    provider: 'google',
  },
  { id: 'deepseek/deepseek-chat', name: 'deepseek-chat', provider: 'deepseek' },
  {
    id: 'groq/llama-4-scout-17b-16e-instruct',
    name: 'llama-4-scout-17b-16e-instruct',
    provider: 'groq',
  },
];

const meta = {
  title: 'Chat/ChatInput',
  component: ChatInput,
  tags: ['autodocs'],
  args: {
    placeholder: 'Type a message...',
    disabled: false,
    isLoading: false,
  },
  argTypes: {
    onSubmit: { description: 'Called when the user sends a message.' },
    onStop: {
      description: 'Called when the user clicks stop during generation.',
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text when the input is empty.',
    },
    disabled: {
      control: 'boolean',
      description: 'Disables input and submit button.',
    },
    isLoading: {
      control: 'boolean',
      description: 'Shows stop button instead of send.',
    },
  },
} satisfies Meta<typeof ChatInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithModelSelector: StoryObj = {
  name: 'With Model Selector',
  render: () => {
    const [selectedModel, setSelectedModel] = useState(sampleModels[0]!.id);
    const [selectorOpen, setSelectorOpen] = useState(true);
    const [messages, setMessages] = useState<string[]>([]);
    const [streaming, setStreaming] = useState(false);

    const selectedName =
      sampleModels.find(m => m.id === selectedModel)?.name ?? selectedModel;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {messages.length > 0 && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--muted-foreground)',
              padding: '8px 12px',
            }}
          >
            {messages.map((m, i) => (
              <div key={i}>→ {m}</div>
            ))}
          </div>
        )}
        {selectorOpen && (
          <ModelSelector
            models={sampleModels}
            selectedModelId={selectedModel}
            onSelect={id => {
              setSelectedModel(id);
              setSelectorOpen(false);
            }}
          />
        )}
        <ChatInput
          placeholder="Ask anything..."
          isLoading={streaming}
          modelLabel={selectedName}
          onModelClick={() => setSelectorOpen(prev => !prev)}
          onSubmit={text => {
            setMessages(prev => [...prev, `[${selectedName}] ${text}`]);
            setStreaming(true);
            setTimeout(() => setStreaming(false), 2000);
          }}
          onStop={() => setStreaming(false)}
        />
      </div>
    );
  },
};

export const Default: Story = {
  args: { onSubmit: () => {} },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    placeholder: 'Type a message...',
    onSubmit: () => {},
  },
};

export const Streaming: Story = {
  args: { isLoading: true, onSubmit: () => {}, onStop: () => {} },
};

export const CustomPlaceholder: Story = {
  args: { placeholder: 'Ask anything...', onSubmit: () => {} },
};

export const Interactive: StoryObj = {
  name: '⚙ Interactive',
  render: () => {
    const [messages, setMessages] = useState<string[]>([]);
    const [streaming, setStreaming] = useState(false);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
          {messages.length === 0
            ? 'Type a message and press Enter to see it logged.'
            : messages.map((m, i) => <div key={i}>→ {m}</div>)}
        </div>
        <ChatInput
          placeholder="Type and press Enter..."
          isLoading={streaming}
          onSubmit={text => {
            setMessages(prev => [...prev, text]);
            setStreaming(true);
            setTimeout(() => setStreaming(false), 2000);
          }}
          onStop={() => setStreaming(false)}
        />
      </div>
    );
  },
};
