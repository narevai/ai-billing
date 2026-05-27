import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import {
  ModelPricingCard,
  ModelsPricingList,
  ModelSearchBox,
  type Model,
} from '@ai-billing/ui';

const decorator = (Story: React.ComponentType) => (
  <div style={{ maxWidth: 720, margin: '0 auto' }}>
    <Story />
  </div>
);

// ── Sample data ────────────────────────────────────────────────────────────────

const claudeSonnet: Model = {
  model_id: 'anthropic/claude-sonnet-4.6',
  provider: 'anthropic',
  subprovider: 'Anthropic',
  pricing: {
    price_prompt: 0.000003,
    price_completion: 0.000015,
    pricing_discount: 0,
    pricing_request: 0,
    price_web_search: 0.01,
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

const claudeOpus: Model = {
  model_id: 'anthropic/claude-opus-4.7',
  provider: 'anthropic',
  subprovider: 'Anthropic',
  pricing: {
    price_prompt: 0.000015,
    price_completion: 0.000075,
    pricing_discount: 0,
    pricing_request: 0,
    price_web_search: 0.01,
    price_input_cache_read: 0.0000015,
    price_input_cache_write: 0.00001875,
    price_image: 0,
    price_image_output: 0,
    price_audio: 0,
    price_audio_output: 0,
    price_input_audio_cache: 0,
    price_internal_reasoning: 0,
  },
};

const minimaxDiscounted: Model = {
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
};

const qwenThinking: Model = {
  model_id: 'Qwen/Qwen3-235B-A22B-Thinking-2507',
  provider: 'chutes',
  subprovider: 'Chutes',
  pricing: {
    price_prompt: 1.1e-7,
    price_completion: 6e-7,
    pricing_discount: 0,
    pricing_request: 0,
    price_web_search: 0,
    price_input_cache_read: 5.5e-8,
    price_input_cache_write: 0,
    price_image: 0,
    price_image_output: 0,
    price_audio: 0,
    price_audio_output: 0,
    price_input_audio_cache: 0,
    price_internal_reasoning: 0,
  },
};

const freeModel: Model = {
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
};

const sampleModels: Model[] = [
  claudeSonnet,
  claudeOpus,
  minimaxDiscounted,
  qwenThinking,
  freeModel,
];

// ── ModelsPricingList stories ───────────────────────────────────────────────────

const listMeta = {
  title: 'Pricing/ModelsPricingList',
  component: ModelsPricingList,
  tags: ['autodocs'],
  decorators: [decorator],
  argTypes: {
    skeletonCount: {
      control: { type: 'number', min: 1, max: 10 },
      description: 'Number of skeleton cards shown while loading.',
      table: { defaultValue: { summary: '5' } },
    },
  },
} satisfies Meta<typeof ModelsPricingList>;

export default listMeta;
type ListStory = StoryObj<typeof listMeta>;

export const Default: ListStory = {
  args: { models: sampleModels },
};

export const Loading: ListStory = {
  args: { loading: true, skeletonCount: 4 },
};

export const Empty: ListStory = {
  args: { models: [] },
};

export const WithDiscount: ListStory = {
  args: {
    models: [
      minimaxDiscounted,
      {
        ...claudeSonnet,
        model_id: 'anthropic/claude-sonnet-4.5',
        pricing: { ...claudeSonnet.pricing, pricing_discount: 0.25 },
      },
    ],
  },
};

export const WithSearchBox: ListStory = {
  name: 'With Search Box',
  render: () => {
    const [search, setSearch] = useState('');
    const filtered = sampleModels.filter(m =>
      m.model_id.toLowerCase().includes(search.toLowerCase()),
    );
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ModelSearchBox value={search} onChange={setSearch} />
        <ModelsPricingList models={filtered} />
      </div>
    );
  },
};

// ── Playground ─────────────────────────────────────────────────────────────────

type PlaygroundArgs = React.ComponentProps<typeof ModelsPricingList> & {
  cardBg: string;
  cardFg: string;
  cardBorder: string;
  mutedBg: string;
  mutedFg: string;
  radius: string;
};

export const Playground: StoryObj<PlaygroundArgs> = {
  name: '⚙ Playground',
  args: {
    models: sampleModels,
    loading: false,
    skeletonCount: 5,
    cardBg: '',
    cardFg: '',
    cardBorder: '',
    mutedBg: '',
    mutedFg: '',
    radius: '0.75rem',
  },
  argTypes: {
    loading: { control: 'boolean', description: 'Show loading skeletons' },
    skeletonCount: { control: { type: 'number', min: 1, max: 10 } },
    cardBg: { control: 'color', description: 'Card background (--card)' },
    cardFg: {
      control: 'color',
      description: 'Card foreground (--card-foreground)',
    },
    cardBorder: { control: 'color', description: 'Border color (--border)' },
    mutedBg: { control: 'color', description: 'Muted background (--muted)' },
    mutedFg: {
      control: 'color',
      description: 'Muted foreground (--muted-foreground)',
    },
    radius: {
      control: { type: 'select' },
      options: ['0', '0.25rem', '0.5rem', '0.75rem', '1rem', '1.5rem', '2rem'],
      description: 'Border radius (--radius)',
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
        <ModelsPricingList {...args} />
      </div>
    );
  },
};
