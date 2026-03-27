import { BillingEvent, UsageEvent } from '@/types/event.js';

export type BillingDestination = {
  readonly destinationId: string;
  process(event: BillingEvent): PromiseLike<void> | void;
};

export type UsageDestination = {
  readonly destinationId: string;
  process(event: UsageEvent): PromiseLike<void> | void;
};
