import type { BillingEvent } from './index.js';

export interface ExtractorContext<TProviderMeta, TCustomMeta, TRawUsage> {
  readonly modelId: string;
  readonly providerId: string;
  readonly customMetadata: TCustomMeta;
  readonly result: {
    readonly usage?: TRawUsage;
    readonly providerMetadata?: TProviderMeta;
    readonly responseId?: string;
  };
}

export type Extractor<TProviderMeta, TCustomMeta, TRawUsage> = (
  context: ExtractorContext<TProviderMeta, TCustomMeta, TRawUsage>,
) =>
  | Promise<BillingEvent<TCustomMeta> | null>
  | BillingEvent<TCustomMeta>
  | null;
