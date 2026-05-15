import type { Meta, StoryObj } from '@storybook/react';
import { CreditUsagePolar } from '@ai-billing/nextjs';

const meta = {
  title: 'Polar/CreditUsagePolar',
  component: CreditUsagePolar,
  tags: ['autodocs'],
  args: { userId: 'usr_test' },
} satisfies Meta<typeof CreditUsagePolar>;

export default meta;
type Story = StoryObj<typeof meta>;

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
