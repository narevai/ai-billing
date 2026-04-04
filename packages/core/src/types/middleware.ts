import { Destination } from '../types/index.js';
import type { JSONObject } from '@ai-sdk/provider';

export type DefaultTags = JSONObject;

export interface BaseBillingMiddlewareOptions<
  TTags extends JSONObject = DefaultTags,
> {
  destinations?: Destination<TTags>[];
  defaultTags?: TTags;
  waitUntil?: (promise: Promise<unknown>) => void;
  onError?: (error: unknown) => void;
}
