import { DefaultTags, BillingEvent } from '../types/index.js';
import type { JSONObject } from '@ai-sdk/provider';

/**
 * Casts a billing event into a JSON object payload.
 * @param event The billing event to cast.
 * @returns The billing event represented as a JSON object.
 */
export function toJSONObject(event: BillingEvent<DefaultTags>): JSONObject {
  return event as unknown as JSONObject;
}
