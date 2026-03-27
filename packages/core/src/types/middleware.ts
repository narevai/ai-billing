import { Extractor, Destination } from '../types/index.js';

export interface BillingMiddlewareOptions<
  TProviderMeta,
  TCustomMeta,
  TRawUsage,
> {
  extractor: Extractor<TProviderMeta, TCustomMeta, TRawUsage>;
  destinations: Destination<TCustomMeta>[];
  metadata?: TCustomMeta;
  waitUntil?: (promise: Promise<unknown>) => void;
  onError?: (error: unknown) => void;
}
