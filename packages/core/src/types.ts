export interface BillingData {
  amount: number;
  generationId: string;
  modelId: string;
  provider: string;
}

/**
 * A plugin destination that receives the final billing data.
 * It can be async or sync.
 */
export type BillingDestination = (data: BillingData) => Promise<void> | void;

/**
 * The configuration object passed into any provider's middleware factory.
 */
export interface BillingDestinationConfig {
  destinations?: BillingDestination[];
}
