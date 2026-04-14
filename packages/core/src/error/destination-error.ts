import { AIBillingError } from './ai-billing-error.js';

const name = 'AiBillingDestinationError';
const marker = `ai-billing.error.${name}`;
const symbol = Symbol.for(marker);

/**
 * Error raised when billing data processing fails for a destination.
 */
export class AiBillingDestinationError extends AIBillingError {
  private readonly [symbol] = true;

  /** The ID of the destination that failed to process billing data. */
  readonly destinationId?: string;

  constructor({
    destinationId,
    message = `Failed to process billing data for destination: '${destinationId}'.`,
    cause,
  }: {
    destinationId?: string;
    message?: string;
    cause?: unknown;
  }) {
    super({ name, message, cause });
    this.destinationId = destinationId;
  }

  static isInstance(error: unknown): error is AiBillingDestinationError {
    return AIBillingError.hasMarker(error, marker);
  }
}
