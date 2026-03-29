import { Destination } from '../types/index.js';

export type DefaultTags = Record<string, unknown>;

export interface BaseBillingMiddlewareOptions<TTags = DefaultTags> {
  destinations: Destination<TTags>[];
  defaultTags?: TTags;
  waitUntil?: (promise: Promise<unknown>) => void;
  onError?: (error: unknown) => void;
}
