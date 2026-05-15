import type { StorybookConfig } from '@storybook/react-vite';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const mocks = join(fileURLToPath(import.meta.url), '..', '..', 'mocks');

function mockAlias(name: string) {
  return [
    { find: `./${name}.js`, replacement: join(mocks, `${name}.ts`) },
    { find: `./${name}.ts`, replacement: join(mocks, `${name}.ts`) },
  ];
}

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
          ...mockAlias('fetchStripeUsage'),
          ...mockAlias('fetchStripeConfig'),
          ...mockAlias('fetchPolarUsage'),
          ...mockAlias('fetchPolarConfig'),
          ...mockAlias('fetchTopUpConfig'),
          ...mockAlias('createCheckout'),
        ],
      },
    };
  },
};

export default config;
