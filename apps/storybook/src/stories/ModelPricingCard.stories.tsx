import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ModelPricingCard, type ModelPricingItem } from '@ai-billing/ui';

const claudeSonnet: ModelPricingItem = {
  model_id: 'anthropic/claude-sonnet-4.6',
  provider_id: 'anthropic',
  pricing: {
    prompt: 0.000003,
    completion: 0.000015,
    discount: 0,
    request: 0,
    web_search: 0,
    input_cache_read: 3e-7,
    input_cache_write: 0.00000375,
    image: 0,
    image_output: 0,
    audio: 0,
    audio_output: 0,
    input_audio_cache: 0,
    internal_reasoning: 0,
  },
};

const meta = {
  title: 'Pricing/ModelPricingCard',
  component: ModelPricingCard,
  tags: ['autodocs'],
  decorators: [
    (Story: React.ComponentType) => (
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ModelPricingCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { model: claudeSonnet },
};

export const WithDiscount: Story = {
  args: {
    model: {
      model_id: 'MiniMax-M2',
      provider_id: 'minimax',
      pricing: {
        prompt: 3e-7,
        completion: 0.0000012,
        discount: 0.15,
        request: 0,
        web_search: 0,
        input_cache_read: 0,
        input_cache_write: 0,
        image: 0,
        image_output: 0,
        audio: 0,
        audio_output: 0,
        input_audio_cache: 0,
        internal_reasoning: 0,
      },
    },
  },
};

export const FreeModel: Story = {
  args: {
    model: {
      model_id: 'baidu/cobuddy:free',
      provider_id: 'baidu',
      pricing: {
        prompt: 0,
        completion: 0,
        discount: 0,
        request: 0,
        web_search: 0,
        input_cache_read: 0,
        input_cache_write: 0,
        image: 0,
        image_output: 0,
        audio: 0,
        audio_output: 0,
        input_audio_cache: 0,
        internal_reasoning: 0,
      },
    },
  },
};

export const NoCacheFields: Story = {
  args: {
    model: {
      model_id: 'MiniMax-M2.7-highspeed',
      provider_id: 'minimax',
      pricing: {
        prompt: 6e-7,
        completion: 0.0000024,
        discount: 0,
        request: 0,
        web_search: 0,
        input_cache_read: 0,
        input_cache_write: 0,
        image: 0,
        image_output: 0,
        audio: 0,
        audio_output: 0,
        input_audio_cache: 0,
        internal_reasoning: 0,
      },
    },
  },
};

export const EnterpriseOnly: Story = {
  name: 'Enterprise Only',
  args: {
    model: {
      model_id: 'anthropic.claude-sonnet-4-20250514-v1:0',
      provider_id: 'bedrock',
      pricing: null,
      message: 'Pricing for this model is available on enterprise plans only.',
    },
  },
};

export const Loading: Story = {
  args: { loading: true },
};

export const Playground: StoryObj<
  React.ComponentProps<typeof ModelPricingCard> & {
    cardBg: string;
    cardFg: string;
    cardBorder: string;
    mutedBg: string;
    mutedFg: string;
    radius: string;
  }
> = {
  name: '⚙ Playground',
  args: {
    model: claudeSonnet,
    cardBg: '',
    cardFg: '',
    cardBorder: '',
    mutedBg: '',
    mutedFg: '',
    radius: '0.75rem',
  },
  argTypes: {
    cardBg: { control: 'color', description: '--card' },
    cardFg: { control: 'color', description: '--card-foreground' },
    cardBorder: { control: 'color', description: '--border' },
    mutedBg: { control: 'color', description: '--muted' },
    mutedFg: { control: 'color', description: '--muted-foreground' },
    radius: {
      control: { type: 'select' },
      options: ['0', '0.25rem', '0.5rem', '0.75rem', '1rem', '1.5rem', '2rem'],
    },
  },
  render: ({
    cardBg,
    cardFg,
    cardBorder,
    mutedBg,
    mutedFg,
    radius,
    ...args
  }) => {
    const vars: Record<string, string> = { '--radius': radius };
    if (cardBg) vars['--card'] = cardBg;
    if (cardFg) vars['--card-foreground'] = cardFg;
    if (cardBorder) vars['--border'] = cardBorder;
    if (mutedBg) vars['--muted'] = mutedBg;
    if (mutedFg) vars['--muted-foreground'] = mutedFg;
    return (
      <div style={vars as React.CSSProperties}>
        <ModelPricingCard {...args} />
      </div>
    );
  },
};
