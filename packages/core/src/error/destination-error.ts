import { AIBillingError } from './ai-billing-error.js';

const name = 'AiBillingDestinationError';
const marker = `ai-billing.error.${name}`;
const symbol = Symbol.for(marker);

export class AiBillingDestinationError extends AIBillingError {
  private readonly [symbol] = true;

  readonly modelId?: string;

  constructor({
    modelId,
    message = `Failed to process billing data for model: '${modelId}'.`,
    cause,
  }: {
    modelId?: string;
    message?: string;
    cause?: unknown;
  }) {
    super({ name, message, cause });
    this.modelId = modelId;
  }

  static isInstance(error: unknown): error is AiBillingDestinationError {
    return AIBillingError.hasMarker(error, marker);
  }
}
