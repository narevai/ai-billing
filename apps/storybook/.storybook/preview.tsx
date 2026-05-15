import type { Preview, Decorator } from '@storybook/react';
import { useEffect } from 'react';
import { withThemeByClassName } from '@storybook/addon-themes';
import './preview.css';

const withMock: Decorator = (Story, ctx) => {
  if (ctx.parameters.mock) globalThis.__SB__ = ctx.parameters.mock;
  useEffect(
    () => () => {
      delete globalThis.__SB__;
    },
    [],
  );
  return <Story />;
};

const preview: Preview = {
  parameters: {
    options: {
      storySort: { method: 'alphabetical', order: ['Polar', 'Stripe'] },
    },
  },
  decorators: [
    withThemeByClassName({
      themes: { light: '', dark: 'dark' },
      defaultTheme: 'light',
    }),
    withMock,
  ],
};

export default preview;
