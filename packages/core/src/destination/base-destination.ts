import {
  BillingDestination,
  BillingEvent,
  UsageDestination,
  UsageEvent,
} from '../types/index.js';
import { AiBillingDestinationError } from '../error/index.js';

interface DestinationInterface<TEvent> {
  readonly destinationId: string;
  process(event: TEvent): Promise<void> | void;
}

export abstract class BaseDestination<
  TEvent extends { modelId: string },
  TConfig = unknown,
> implements DestinationInterface<TEvent> {
  public abstract readonly destinationId: string;
  protected config: TConfig;

  constructor(config: TConfig) {
    this.config = config;
  }

  public async process(data: TEvent): Promise<void> {
    try {
      await this.recordEvent(data);
    } catch (error) {
      throw new AiBillingDestinationError({
        modelId: data.modelId,
        cause: error,
      });
    }
  }

  protected abstract recordEvent(data: TEvent): Promise<void> | void;
}

export abstract class BaseUsageDestination<TConfig = unknown>
  extends BaseDestination<UsageEvent, TConfig>
  implements UsageDestination {}

export abstract class BaseBillingDestination<TConfig = unknown>
  extends BaseDestination<BillingEvent, TConfig>
  implements BillingDestination {}
