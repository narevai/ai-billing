import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { CreditTopUpPolar } from '@ai-billing/nextjs';

const pkgs = [
  { id: 'pkg_1', credits: 5, priceCents: 500 },
  { id: 'pkg_2', credits: 10, priceCents: 1000 },
  { id: 'pkg_3', credits: 25, priceCents: 2500 },
  { id: 'pkg_4', credits: 50, priceCents: 5000 },
  { id: 'pkg_5', credits: 100, priceCents: 10000 },
];

const meta = {
  title: 'Polar/CreditTopUpPolar',
  component: CreditTopUpPolar,
  tags: ['autodocs'],
  args: { userId: 'usr_test' },
  argTypes: {
    userId: {
      control: 'text',
      description: 'End-user ID passed to the Polar checkout session.',
    },
    title: {
      control: 'text',
      description: 'Heading shown above the package list.',
      table: {
        defaultValue: {
          summary: '"Choose a credit bundle to top up your workspace balance."',
        },
      },
    },
    successUrl: {
      control: 'text',
      description:
        'URL the user is redirected to after a successful purchase. Defaults to the current page origin.',
      table: { defaultValue: { summary: 'window.location.origin + "/"' } },
    },
  },
} satisfies Meta<typeof CreditTopUpPolar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: { mock: { topUpConfig: { packages: pkgs } } },
};

export const Loading: Story = {
  parameters: { mock: { topUpConfigDelay: -1 } },
};

export const NoPackages: Story = {
  parameters: { mock: { topUpConfig: { packages: [] } } },
};

export const WithPackages: Story = {
  parameters: { mock: { topUpConfig: { packages: pkgs } } },
};

export const CustomTitle: Story = {
  args: { title: 'Buy more credits to continue using the service.' },
  parameters: { mock: { topUpConfig: { packages: pkgs } } },
};

export const TaxInclusive: Story = {
  parameters: {
    mock: { topUpConfig: { packages: pkgs, taxBehavior: 'inclusive' } },
  },
};

export const TaxExclusive: Story = {
  parameters: {
    mock: { topUpConfig: { packages: pkgs, taxBehavior: 'exclusive' } },
  },
};

export const TaxLocationBased: Story = {
  parameters: {
    mock: { topUpConfig: { packages: pkgs, taxBehavior: 'location' } },
  },
};

// ─── Playground ───────────────────────────────────────────────────────────────

type PlaygroundArgs = React.ComponentProps<typeof CreditTopUpPolar> & {
  hasPackages: boolean;
  taxBehavior: 'none' | 'inclusive' | 'exclusive' | 'location';
  loading: boolean;
  cardBg: string;
  cardFg: string;
  cardBorder: string;
  selectionBg: string;
  mutedFg: string;
  primaryColor: string;
  primaryFg: string;
  radius: string;
};

export const Playground: StoryObj<PlaygroundArgs> = {
  name: '⚙ Playground',
  args: {
    userId: 'usr_test',
    title: 'Choose a credit bundle to top up your workspace balance.',
    hasPackages: true,
    taxBehavior: 'none',
    loading: false,
    cardBg: '',
    cardFg: '',
    cardBorder: '',
    selectionBg: '',
    mutedFg: '',
    primaryColor: '',
    primaryFg: '',
    radius: '0.75rem',
  },
  argTypes: {
    title: { control: 'text', description: 'Title / description' },
    hasPackages: { control: 'boolean', description: 'Show packages' },
    taxBehavior: {
      control: { type: 'select' },
      options: ['none', 'inclusive', 'exclusive', 'location'],
      description: 'Tax note',
    },
    loading: { control: 'boolean', description: 'Show loading skeleton' },
    cardBg: { control: 'color', description: 'Card background' },
    cardFg: { control: 'color', description: 'Card text color' },
    cardBorder: { control: 'color', description: 'Card border' },
    selectionBg: { control: 'color', description: 'Selected row background' },
    mutedFg: { control: 'color', description: 'Muted text color' },
    primaryColor: { control: 'color', description: 'Button background' },
    primaryFg: { control: 'color', description: 'Button text color' },
    radius: {
      control: { type: 'select' },
      options: ['0', '0.25rem', '0.5rem', '0.75rem', '1rem', '1.5rem', '2rem'],
      description: 'Border radius',
    },
  },
  render: ({
    hasPackages,
    taxBehavior,
    loading,
    cardBg,
    cardFg,
    cardBorder,
    selectionBg,
    mutedFg,
    primaryColor,
    primaryFg,
    radius,
    ...args
  }) => {
    globalThis.__SB__ = loading
      ? { topUpConfigDelay: -1 }
      : {
          topUpConfig: {
            packages: hasPackages ? pkgs : [],
            taxBehavior: taxBehavior === 'none' ? undefined : taxBehavior,
          },
        };
    return (
      <div
        style={(() => {
          const vars: Record<string, string> = { '--radius': radius };
          if (cardBg) vars['--card'] = cardBg;
          if (cardFg) vars['--card-foreground'] = cardFg;
          if (cardBorder) vars['--border'] = cardBorder;
          if (selectionBg) vars['--muted'] = selectionBg;
          if (mutedFg) vars['--muted-foreground'] = mutedFg;
          if (primaryColor) vars['--primary'] = primaryColor;
          if (primaryFg) vars['--primary-foreground'] = primaryFg;
          return vars as React.CSSProperties;
        })()}
      >
        <CreditTopUpPolar
          key={`${hasPackages}-${taxBehavior}-${loading}`}
          {...args}
        />
      </div>
    );
  },
};
