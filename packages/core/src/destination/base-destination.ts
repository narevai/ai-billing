import type { Destination, BillingEvent, DefaultTags } from '../types/index.js';
import { AiBillingDestinationError } from '../error/index.js';

export function createDestination<TTags extends DefaultTags = DefaultTags>(
  destinationId: string,
  handler: (event: BillingEvent<TTags>) => Promise<void> | void,
): Destination<TTags> {
  return async (event: BillingEvent<TTags>) => {
    try {
      await handler(event);
    } catch (error) {
      throw new AiBillingDestinationError({
        destinationId,
        cause: error,
      });
    }
  };
}
