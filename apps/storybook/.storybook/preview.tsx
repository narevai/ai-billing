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
      storySort: (a: { title: string }, b: { title: string }) => {
        const o = [
          'Polar/CreditUsagePolar',
          'Polar/CreditTopUpPolar',
          'Stripe/CreditUsageStripe',
        ];
        const ai = o.findIndex(x => a.title.startsWith(x));
        const bi = o.findIndex(x => b.title.startsWith(x));
        if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        return a.title.localeCompare(b.title);
      },
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
