import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { CreditUsageStripe } from '@ai-billing/nextjs';

const meta = {
  title: 'Stripe/CreditUsageStripe',
  component: CreditUsageStripe,
  tags: ['autodocs'],
  args: { stripeCustomerId: 'cus_test' },
} satisfies Meta<typeof CreditUsageStripe>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  parameters: { mock: { stripeUsageDelay: -1 } },
};

export const NoData: Story = {
  parameters: { mock: { stripeUsage: { aggregatedValue: 0, found: false } } },
};

export const LowUsage: Story = {
  args: { budget: 100 },
  parameters: { mock: { stripeUsage: { aggregatedValue: 20, found: true } } },
};

export const MediumUsage: Story = {
  args: { budget: 100 },
  parameters: { mock: { stripeUsage: { aggregatedValue: 75, found: true } } },
};

export const OverBudget: Story = {
  args: { budget: 100 },
  parameters: { mock: { stripeUsage: { aggregatedValue: 120, found: true } } },
};

export const CustomLabelAndUnit: Story = {
  args: { budget: 50, label: 'API usage this month', unit: '€' },
  parameters: { mock: { stripeUsage: { aggregatedValue: 32, found: true } } },
};

export const NoBudget: Story = {
  parameters: { mock: { stripeUsage: { aggregatedValue: 150, found: true } } },
};

// ─── Playground ───────────────────────────────────────────────────────────────

type PlaygroundArgs = React.ComponentProps<typeof CreditUsageStripe> & {
  aggregatedValue: number;
  loading: boolean;
  cardBg: string;
  cardFg: string;
  cardBorder: string;
  trackColor: string;
  mutedFg: string;
  radius: string;
};

export const Playground: StoryObj<PlaygroundArgs> = {
  name: '⚙ Playground',
  args: {
    stripeCustomerId: 'cus_test',
    budget: 100,
    label: '',
    unit: '$',
    aggregatedValue: 42,
    loading: false,
    cardBg: '',
    cardFg: '',
    cardBorder: '',
    trackColor: '',
    mutedFg: '',
    radius: '0.75rem',
  },
  argTypes: {
    aggregatedValue: {
      control: { type: 'range', min: 0, max: 300, step: 1 },
      description: 'Current usage value',
    },
    budget: {
      control: { type: 'range', min: 0, max: 500, step: 10 },
      description: 'Budget cap (0 = no cap)',
    },
    label: {
      control: 'text',
      description: 'Label (leave empty for auto month/year)',
    },
    loading: { control: 'boolean', description: 'Show loading skeleton' },
    unit: {
      control: { type: 'select' },
      options: ['$', '€', '£', '¥', 'credits', 'tokens', 'GB', 'requests'],
      description: 'Unit',
    },
    cardBg: { control: 'color', description: 'Card background' },
    cardFg: { control: 'color', description: 'Card text color' },
    cardBorder: { control: 'color', description: 'Card border' },
    trackColor: { control: 'color', description: 'Bar track color' },
    mutedFg: { control: 'color', description: 'Muted text color' },
    radius: {
      control: { type: 'select' },
      options: ['0', '0.25rem', '0.5rem', '0.75rem', '1rem', '1.5rem', '2rem'],
      description: 'Border radius',
    },
  },
  render: ({
    aggregatedValue,
    loading,
    cardBg,
    cardFg,
    cardBorder,
    trackColor,
    mutedFg,
    radius,
    ...args
  }) => {
    globalThis.__SB__ = loading
      ? { stripeUsageDelay: -1 }
      : { stripeUsage: { aggregatedValue, found: true } };
    return (
      <div
        style={(() => {
          const vars: Record<string, string> = { '--radius': radius };
          if (cardBg) vars['--card'] = cardBg;
          if (cardFg) vars['--card-foreground'] = cardFg;
          if (cardBorder) vars['--border'] = cardBorder;
          if (trackColor) vars['--muted'] = trackColor;
          if (mutedFg) vars['--muted-foreground'] = mutedFg;
          return vars as React.CSSProperties;
        })()}
      >
        <CreditUsageStripe key={`${aggregatedValue}-${loading}`} {...args} />
      </div>
    );
  },
};
