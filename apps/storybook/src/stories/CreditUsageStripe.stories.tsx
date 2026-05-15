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
