import type { BillingEvent } from './event.js';

export type Destination<TCustomMeta = Record<string, unknown>> = (
  event: BillingEvent<TCustomMeta>,
) => Promise<void> | void;
