import type { Meta, StoryObj } from '@storybook/react';

const Hello = () => (
  <div style={{ padding: 24, background: 'lightgreen', borderRadius: 8, fontFamily: 'system-ui' }}>
    Hello World — Storybook works!
  </div>
);

const meta = { title: 'Debug/Test', component: Hello } satisfies Meta<typeof Hello>;
export default meta;
type Story = StoryObj<typeof meta>;
export const HelloStory: Story = {};
