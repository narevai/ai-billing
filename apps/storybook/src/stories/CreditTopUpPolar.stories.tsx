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
} satisfies Meta<typeof CreditTopUpPolar>;

export default meta;
type Story = StoryObj<typeof meta>;

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
