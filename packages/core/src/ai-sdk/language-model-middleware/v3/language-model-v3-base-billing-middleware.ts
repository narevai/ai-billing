import { AiHandleBillingError } from '@/error/index.js';
import {
  BillingDestination,
  UsageEvent,
  CostResolver,
  BillingEvent,
  UsageDestination,
} from '@/types/index.js';
import type {
  LanguageModelV3Middleware,
  LanguageModelV3StreamPart,
  LanguageModelV3Usage,
  SharedV3ProviderMetadata,
} from '@ai-sdk/provider';

export abstract class LanguageModelV3BillingMiddleware<
  TMetadata = unknown,
> implements LanguageModelV3Middleware {
  readonly specificationVersion = 'v3';

  private usageDestinations?: UsageDestination[];
  private billingDestinations?: BillingDestination[];
  private costResolver?: CostResolver;
  private waitUntil?: (promise: Promise<unknown>) => void;

  constructor(config: {
    usageDestinations?: UsageDestination[];
    billingDestinations?: BillingDestination[];
    costResolver?: CostResolver;
    waitUntil?: (promise: Promise<unknown>) => void;
  }) {
    this.usageDestinations = config.usageDestinations ?? [];
    this.billingDestinations = config.billingDestinations ?? [];
    this.costResolver = config.costResolver;
    this.waitUntil = config.waitUntil;
  }

  protected abstract extractUsageEvent(
    genId: string | undefined,
    modelId: string,
    providerId: string,
    providerMetadata: SharedV3ProviderMetadata | undefined,
    usage: LanguageModelV3Usage,
  ): Promise<UsageEvent | null>;

  protected onBillingError(err: unknown) {
    if (AiHandleBillingError.isInstance(err)) {
      console.error(`[AIBilling] ${err.message}`, {
        provider: err.provider,
        cause: err.cause,
      });
    } else {
      console.error('[AIBilling] Unexpected Error:', err);
    }
  }

  protected async resolveBillingEvent(
    usageEvent: UsageEvent,
  ): Promise<BillingEvent | null> {
    if (!this.costResolver) return null;

    const cost = await this.costResolver.resolve(usageEvent);
    if (!cost) return null;

    const resolvedEvent: BillingEvent = {
      ...usageEvent,
      cost,
    };

    return resolvedEvent;
  }

  protected async broadcastUsageEvent(event: UsageEvent): Promise<void> {
    if (this.usageDestinations) {
      await Promise.allSettled(
        this.usageDestinations.map(d => Promise.resolve(d.process(event))),
      );
    }
  }

  protected async broadcastBillingEvent(event: BillingEvent): Promise<void> {
    if (this.billingDestinations) {
      await Promise.allSettled(
        this.billingDestinations.map(d => Promise.resolve(d.process(event))),
      );
    }
  }

  private async handleBilling(
    genId: string | undefined,
    modelId: string,
    providerId: string,
    providerMetadata: SharedV3ProviderMetadata | undefined,
    usage: LanguageModelV3Usage | undefined,
  ): Promise<void> {
    try {
      if (!usage) return;

      const usageEvent = await this.extractUsageEvent(
        genId,
        modelId,
        providerId,
        providerMetadata,
        usage,
      );

      if (!usageEvent) return;

      await this.broadcastUsageEvent(usageEvent);

      const billingEvent = await this.resolveBillingEvent(usageEvent);

      if (billingEvent) {
        await this.broadcastBillingEvent(billingEvent);
      }
    } catch (error) {
      this.onBillingError(error);
    }
  }

  wrapGenerate: LanguageModelV3Middleware['wrapGenerate'] = async ({
    doGenerate,
    model,
  }) => {
    const result = await doGenerate();

    const billingPromise = this.handleBilling(
      result.response?.id,
      model.modelId,
      model.provider,
      result.providerMetadata,
      result.usage,
    );

    if (this.waitUntil) {
      this.waitUntil(billingPromise);
    }

    return result;
  };

  wrapStream: LanguageModelV3Middleware['wrapStream'] = async ({
    doStream,
    model,
  }) => {
    const { stream, ...rest } = await doStream();

    let genId: string | undefined = undefined;
    let providerMetadata: SharedV3ProviderMetadata | undefined = undefined;
    let usage: LanguageModelV3Usage | undefined = undefined;

    const billedStream = stream.pipeThrough(
      new TransformStream<LanguageModelV3StreamPart, LanguageModelV3StreamPart>(
        {
          transform: async (chunk, controller) => {
            switch (chunk.type) {
              case 'response-metadata':
              case 'text-start':
                if (chunk.id) genId = chunk.id;
                break;
              case 'finish':
                if (chunk.providerMetadata)
                  providerMetadata = chunk.providerMetadata;
                usage = chunk.usage;
                break;
            }
            controller.enqueue(chunk);
          },
          flush: async () => {
            const billingPromise = this.handleBilling(
              genId,
              model.modelId,
              model.provider,
              providerMetadata,
              usage,
            ).catch(err => this.onBillingError(err));
            if (this.waitUntil) {
              this.waitUntil(billingPromise);
            }
          },
        },
      ),
    );

    return { ...rest, stream: billedStream };
  };
}
