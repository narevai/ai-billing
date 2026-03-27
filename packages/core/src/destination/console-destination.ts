import { BaseBillingDestination } from './base-destination.js';
import { BaseUsageDestination } from './base-destination.js';
import { BillingEvent, UsageEvent } from '../types/index.js';

// Specific to billing
export class ConsoleBillingDestination extends BaseBillingDestination {
  readonly destinationId = 'console-billing';
  protected recordEvent(event: BillingEvent) {
    console.log(`$$$ [Billing] ${event.modelId}: ${event.cost}`);
  }
}

// Specific to raw usage
export class ConsoleUsageDestination extends BaseUsageDestination {
  readonly destinationId = 'console-usage';
  protected recordEvent(event: UsageEvent) {
    console.log(`[Usage] ${event.modelId}: ${event.usage.totalTokens} tokens`);
  }
}
