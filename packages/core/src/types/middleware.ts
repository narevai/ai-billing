import { Destination } from '../types/index.js';
import type { JSONObject } from '@ai-sdk/provider';

export type DefaultTags = JSONObject;

export interface BaseBillingMiddlewareOptions<
  TTags extends JSONObject = DefaultTags,
> {
  /** One or more billing destinations that receive each emitted {@link BillingEvent}. */
  destinations?: Destination<TTags>[];
  /** Tags merged into every emitted event. */
  defaultTags?: TTags;
  /**
   * Edge-runtime hook (e.g. `ctx.waitUntil`) used to keep the process alive
   * while billing events are flushed asynchronously.
   */
  waitUntil?: (promise: Promise<unknown>) => void;
  /** Called when an error occurs during event extraction or dispatch. Defaults to a silent no-op. */
  onError?: (error: unknown) => void;
}
