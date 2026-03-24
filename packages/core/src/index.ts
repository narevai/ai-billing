declare const __PACKAGE_VERSION__: string;

export const version = __PACKAGE_VERSION__;

export type BillingProvider = 'stripe' | 'lemonsqueezy' | 'polar';

export interface BillingConfig {
  apiKey: string;
  provider: BillingProvider;
}

export const initializeBilling = (config: BillingConfig) => {
  return `ai-billing core v${version} initialized for ${config.provider}`;
};