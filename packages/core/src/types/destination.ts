import type { DefaultTags, BillingEvent } from './index.js';

export type Destination<TTags = DefaultTags> = (
  event: BillingEvent<TTags>,
) => Promise<void> | void;
