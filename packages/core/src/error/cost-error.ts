import { AIBillingError } from './ai-billing-error.js';

const name = 'AiBillingCostError';
const marker = `ai-billing.error.${name}`;
const symbol = Symbol.for(marker);

export class AiBillingCostError extends AIBillingError {
  private readonly [symbol] = true;

  constructor({ message, cause }: { message: string; cause?: unknown }) {
    super({ name, message, cause });
  }

  static isInstance(error: unknown): error is AiBillingCostError {
    return AIBillingError.hasMarker(error, marker);
  }
}
