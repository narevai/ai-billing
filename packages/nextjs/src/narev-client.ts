import { createNarevClient } from '@ai-billing/narev';
import type { NarevClient } from '@ai-billing/narev';

let _client: NarevClient | undefined;

export function getNarevClient(): NarevClient {
  if (!_client) {
    const apiKey = process.env.NAREV_API_KEY;
    if (!apiKey) {
      throw new Error('NAREV_API_KEY is not set');
    }
    _client = createNarevClient({ apiKey });
  }
  return _client;
}
