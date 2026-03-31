import type { DefaultTags, BillingEvent } from './index.js';

export type Destination<TTags extends DefaultTags = DefaultTags> = (
  event: BillingEvent<TTags>,
) => Promise<void> | void;
