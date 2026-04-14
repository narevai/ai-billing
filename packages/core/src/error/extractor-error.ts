import { AIBillingError } from './ai-billing-error.js';

const name = 'AiBillingExtractorError';
const marker = `ai-billing.error.${name}`;
const symbol = Symbol.for(marker);

/** Error thrown when billing data extraction fails. */
export class AiBillingExtractorError extends AIBillingError {
  private readonly [symbol] = true;

  constructor({
    message = `Failed to extract billing data.`,
    cause,
  }: {
    message?: string;
    cause?: unknown;
  }) {
    super({ name, message, cause });
  }

  static isInstance(error: unknown): error is AiBillingExtractorError {
    return AIBillingError.hasMarker(error, marker);
  }
}
