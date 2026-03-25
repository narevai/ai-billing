import { BaseBillingDestination } from './base-billing-destination.js';
import type { BillingData } from '../types.js';

export interface ConsoleDestinationOptions {
  prefix?: string;
}

/**
 * A simple destination that logs the billing event to the terminal.
 */
export class ConsoleDestination extends BaseBillingDestination<ConsoleDestinationOptions> {
  constructor(options: ConsoleDestinationOptions = {}) {
    // Pass the options up to the base class, applying defaults
    super({
      prefix: options.prefix ?? '[ai-billing]',
    });
  }

  protected process(data: BillingData): void {
    const { prefix } = this.config;
    const formattedAmount = data.amount.toFixed(6);

    // Optional: Log token counts if they exist
    const tokenString = data.totalTokens
      ? ` | Tokens: ${data.totalTokens}`
      : '';

    console.log(
      `${prefix} $${formattedAmount} | Model: ${data.modelId} | Provider: ${data.provider}${tokenString}`,
    );
  }
}
