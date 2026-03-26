import { AiBillingDestinationError } from '../error/index.js';
import type { BillingData, BillingDestination } from '../types.js';

export abstract class BaseBillingDestination<TConfig = unknown> {
  protected config: TConfig;

  constructor(config: TConfig) {
    this.config = config;
  }

  protected abstract process(data: BillingData): Promise<void> | void;

  public readonly handle: BillingDestination = async data => {
    try {
      await this.process(data);
    } catch (error) {
      throw new AiBillingDestinationError({
        modelId: data.modelId,
        cause: error,
      });
    }
  };
}
