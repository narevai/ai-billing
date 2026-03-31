import { DefaultTags, BillingEvent } from '../types/index.js';
import type { JSONObject } from '@ai-sdk/provider';

export function toJSONObject(event: BillingEvent<DefaultTags>): JSONObject {
  return event as unknown as JSONObject;
}
