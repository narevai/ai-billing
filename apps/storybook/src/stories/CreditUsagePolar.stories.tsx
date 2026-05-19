import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { CreditUsagePolar } from '@ai-billing/nextjs';

const meta = {
  title: 'Polar/CreditUsagePolar',
  component: CreditUsagePolar,
  tags: ['autodocs'],
  args: { userId: 'usr_test' },
  argTypes: {
    userId: {
      control: 'text',
      description: 'Polar user ID used to fetch metered usage.',
    },
    budget: {
      control: { type: 'number', min: 0, max: 500, step: 10 },
      description:
        'Spending cap that overrides the credited-unit balance from Polar. Omit to use the credited units as the cap.',
      table: { defaultValue: { summary: 'undefined' } },
    },
    label: {
      control: 'text',
      description:
        'Custom card heading. Defaults to the meter name returned by Polar.',
      table: { defaultValue: { summary: 'meter name from Polar' } },
    },
  },
} satisfies Meta<typeof CreditUsagePolar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    mock: {
      polarUsage: {
        consumedUnits: 42,
        creditedUnits: 100,
        meterName: 'AI Credits',
        found: true,
      },
    },
  },
};

export const Loading: Story = {
  parameters: { mock: { polarUsageDelay: -1 } },
};

export const NoData: Story = {
  parameters: {
    mock: {
      polarUsage: {
        consumedUnits: 0,
        creditedUnits: 0,
        meterName: 'Usage',
        found: false,
      },
    },
  },
};

export const NormalUsage: Story = {
  parameters: {
    mock: {
      polarUsage: {
        consumedUnits: 42,
        creditedUnits: 100,
        meterName: 'Tokens',
        found: true,
      },
    },
  },
};

export const HighUsage: Story = {
  args: { budget: 100 },
  parameters: {
    mock: {
      polarUsage: {
        consumedUnits: 95,
        creditedUnits: 100,
        meterName: 'Tokens',
        found: true,
      },
    },
  },
};

export const CustomLabel: Story = {
  args: { budget: 50, label: 'GPT-4o tokens' },
  parameters: {
    mock: {
      polarUsage: {
        consumedUnits: 28,
        creditedUnits: 50,
        meterName: 'Tokens',
        found: true,
      },
    },
  },
};

// ─── Playground ───────────────────────────────────────────────────────────────

type PlaygroundArgs = React.ComponentProps<typeof CreditUsagePolar> & {
  consumedUnits: number;
  creditedUnits: number;
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
    userId: 'usr_test',
    budget: 100,
    label: 'AI Credits',
    consumedUnits: 42,
    creditedUnits: 100,
    loading: false,
    cardBg: '',
    cardFg: '',
    cardBorder: '',
    trackColor: '',
    mutedFg: '',
    radius: '0.75rem',
  },
  argTypes: {
    consumedUnits: {
      control: { type: 'range', min: 0, max: 200, step: 1 },
      description: 'Consumed credits',
    },
    creditedUnits: {
      control: { type: 'range', min: 1, max: 200, step: 1 },
      description: 'Total credits',
    },
    budget: {
      control: { type: 'range', min: 0, max: 500, step: 10 },
      description: 'Budget cap (0 = use credited units)',
    },
    label: { control: 'text', description: 'Label' },
    loading: { control: 'boolean', description: 'Show loading skeleton' },
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
    consumedUnits,
    creditedUnits,
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
      ? { polarUsageDelay: -1 }
      : {
          polarUsage: {
            consumedUnits,
            creditedUnits,
            meterName: 'Credits',
            found: true,
          },
        };
    const vars: Record<string, string> = { '--radius': radius };
    if (cardBg) vars['--card'] = cardBg;
    if (cardFg) vars['--card-foreground'] = cardFg;
    if (cardBorder) vars['--border'] = cardBorder;
    if (trackColor) vars['--muted'] = trackColor;
    if (mutedFg) vars['--muted-foreground'] = mutedFg;
    return (
      <div style={vars as React.CSSProperties}>
        <CreditUsagePolar
          key={`${consumedUnits}-${creditedUnits}-${loading}`}
          {...args}
        />
      </div>
    );
  },
};
