import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ModelPricingCard, type Model } from '@ai-billing/ui';

const claudeSonnet: Model = {
  model_id: 'anthropic/claude-sonnet-4.6',
  provider: 'anthropic',
  subprovider: 'Anthropic',
  pricing: {
    price_prompt: 0.000003,
    price_completion: 0.000015,
    pricing_discount: 0,
    pricing_request: 0,
    price_web_search: 0,
    price_input_cache_read: 3e-7,
    price_input_cache_write: 0.00000375,
    price_image: 0,
    price_image_output: 0,
    price_audio: 0,
    price_audio_output: 0,
    price_input_audio_cache: 0,
    price_internal_reasoning: 0,
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
      provider: 'minimax',
      subprovider: 'Minimax',
      pricing: {
        price_prompt: 3e-7,
        price_completion: 0.0000012,
        pricing_discount: 0.15,
        pricing_request: 0,
        price_web_search: 0,
        price_input_cache_read: 0,
        price_input_cache_write: 0,
        price_image: 0,
        price_image_output: 0,
        price_audio: 0,
        price_audio_output: 0,
        price_input_audio_cache: 0,
        price_internal_reasoning: 0,
      },
    },
  },
};

export const FreeModel: Story = {
  args: {
    model: {
      model_id: 'baidu/cobuddy:free',
      provider: 'baidu',
      subprovider: 'Baidu',
      pricing: {
        price_prompt: 0,
        price_completion: 0,
        pricing_discount: 0,
        pricing_request: 0,
        price_web_search: 0,
        price_input_cache_read: 0,
        price_input_cache_write: 0,
        price_image: 0,
        price_image_output: 0,
        price_audio: 0,
        price_audio_output: 0,
        price_input_audio_cache: 0,
        price_internal_reasoning: 0,
      },
    },
  },
};

export const NoCacheFields: Story = {
  args: {
    model: {
      model_id: 'MiniMax-M2.7-highspeed',
      provider: 'minimax',
      subprovider: 'Minimax',
      pricing: {
        price_prompt: 6e-7,
        price_completion: 0.0000024,
        pricing_discount: 0,
        pricing_request: 0,
        price_web_search: 0,
        price_input_cache_read: 0,
        price_input_cache_write: 0,
        price_image: 0,
        price_image_output: 0,
        price_audio: 0,
        price_audio_output: 0,
        price_input_audio_cache: 0,
        price_internal_reasoning: 0,
      },
    },
  },
};

export const EnterpriseOnly: Story = {
  name: 'Enterprise Only',
  args: {
    model: {
      model_id: 'anthropic.claude-sonnet-4-20250514-v1:0',
      provider: 'bedrock',
      subprovider: 'Amazon Bedrock',
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
