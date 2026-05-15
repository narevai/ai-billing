import type { StorybookConfig } from '@storybook/react-vite';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const mocks = join(fileURLToPath(import.meta.url), '..', '..', 'mocks');

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-themes'],
  framework: { name: '@storybook/react-vite', options: {} },
  async viteFinal(cfg) {
    return {
      ...cfg,
      resolve: {
        ...cfg.resolve,
        alias: [
          {
            find: /\.\/fetchStripeUsage(\.[jt]s)?$/,
            replacement: join(mocks, 'fetchStripeUsage.ts'),
          },
          {
            find: /\.\/fetchStripeConfig(\.[jt]s)?$/,
            replacement: join(mocks, 'fetchStripeConfig.ts'),
          },
          {
            find: /\.\/fetchPolarUsage(\.[jt]s)?$/,
            replacement: join(mocks, 'fetchPolarUsage.ts'),
          },
          {
            find: /\.\/fetchPolarConfig(\.[jt]s)?$/,
            replacement: join(mocks, 'fetchPolarConfig.ts'),
          },
          {
            find: /\.\/fetchTopUpConfig(\.[jt]s)?$/,
            replacement: join(mocks, 'fetchTopUpConfig.ts'),
          },
          {
            find: /\.\/createCheckout(\.[jt]s)?$/,
            replacement: join(mocks, 'createCheckout.ts'),
          },
        ],
      },
    };
  },
};

export default config;
