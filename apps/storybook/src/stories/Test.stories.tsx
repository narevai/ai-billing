import type { Meta, StoryObj } from '@storybook/react';

interface HelloProps {
  bg?: string;
  fg?: string;
  text?: string;
  fontSize?: number;
  radius?: number;
}

const Hello = ({ bg, fg, text, fontSize, radius }: HelloProps) => (
  <div style={{
    padding: 24,
    borderRadius: radius ?? 8,
    background: bg ?? 'var(--card)',
    color: fg ?? 'var(--card-foreground)',
    border: '1px solid var(--border)',
    fontSize: fontSize ?? 14,
  }}>
    {text ?? 'Hello World'}
  </div>
);

const meta = {
  title: 'Debug/Test',
  component: Hello,
  argTypes: {
    bg: { control: 'color', name: 'Background' },
    fg: { control: 'color', name: 'Text color' },
    text: { control: 'text', name: 'Text' },
    fontSize: { control: 'number', name: 'Font size' },
    radius: { control: 'number', name: 'Border radius' },
  },
} satisfies Meta<typeof Hello>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  args: { text: 'Hello World', fontSize: 14, radius: 8 },
};
