import { AIBillingError } from './ai-billing-error.js';

const name = 'AiBillingExtractError';
const marker = `ai-billing.error.${name}`;
const symbol = Symbol.for(marker);

export class AiBillingExtractError extends AIBillingError {
  private readonly [symbol] = true;

  readonly provider: string;
  readonly metadata: unknown;

  constructor({
    provider,
    metadata,
    message = `Failed to extract billing data from provider: '${provider}'.`,
    cause,
  }: {
    provider: string;
    metadata: unknown;
    message?: string;
    cause?: unknown;
  }) {
    super({ name, message, cause });
    this.provider = provider;
    this.metadata = metadata;
  }

  static isInstance(error: unknown): error is AiBillingExtractError {
    return AIBillingError.hasMarker(error, marker);
  }
}
