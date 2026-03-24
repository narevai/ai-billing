declare const __PACKAGE_VERSION__: string;

export const version = __PACKAGE_VERSION__;

export const initializeStripeBilling = () => {
  return `ai-billing core v${version} initialized for stripe`;
};