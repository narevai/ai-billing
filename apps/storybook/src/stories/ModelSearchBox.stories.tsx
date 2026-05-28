import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ModelSearchBox } from '@ai-billing/ui';

const meta = {
  title: 'Pricing/ModelSearchBox',
  component: ModelSearchBox,
  parameters: { layout: 'centered' },
  decorators: [
    Story => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ModelSearchBox>;

export default meta;
type Story = StoryObj<typeof meta>;

function Controlled({ initialValue = '' }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  return <ModelSearchBox value={value} onChange={setValue} />;
}

export const Empty: Story = {
  render: () => <Controlled />,
};

export const WithValue: Story = {
  render: () => <Controlled initialValue="claude-3" />,
};

export const CustomPlaceholder: Story = {
  render: () => {
    const [value, setValue] = useState('');
    return (
      <ModelSearchBox
        value={value}
        onChange={setValue}
        placeholder="Filter by model ID…"
      />
    );
  },
};

export const Playground: Story = {
  args: {
    value: '',
    onChange: () => {},
    placeholder: 'Search models…',
  },
};
