import type {
  LanguageModelV3Middleware,
  LanguageModelV3StreamPart,
} from '@ai-sdk/provider';
import type {
  BillingDestinationConfig,
  BillingDestination,
  BillingData,
} from '../../../types.js';

export abstract class LanguageModelV3BillingMiddleware<
  TMetadata = unknown,
> implements LanguageModelV3Middleware {
  readonly specificationVersion = 'v3';

  private destinations: BillingDestination[];

  constructor(config: BillingDestinationConfig) {
    this.destinations = config.destinations ?? [];
  }

  /**
   * Every provider sub-package (OpenRouter, OpenAI) implements this.
   */
  protected abstract extractBilling(
    metadata: TMetadata | undefined,
    responseId: string | undefined,
    modelId: string,
    provider: string,
  ):
    | Promise<{ cost: number; genId: string } | null>
    | { cost: number; genId: string }
    | null;

  /**
   * Safely broadcasts the capture event to all plugged-in destinations.
   * Uses Promise.allSettled.
   */
  private async broadcastCapture(
    billing: { cost: number; genId: string } | null | undefined,
    modelId: string,
    provider: string,
  ) {
    if (!billing || this.destinations.length === 0) {
      return;
    }

    const billingData: BillingData = {
      amount: billing.cost,
      generationId: billing.genId,
      modelId: modelId,
      provider: provider,
    };

    await Promise.allSettled(
      this.destinations.map(destination =>
        Promise.resolve(destination(billingData)),
      ),
    );
  }

  wrapGenerate: LanguageModelV3Middleware['wrapGenerate'] = async ({
    doGenerate,
    model,
  }) => {
    const result = await doGenerate();

    const billing = await this.extractBilling(
      result.providerMetadata as TMetadata,
      result.response?.id,
      model.modelId,
      model.provider,
    );

    await this.broadcastCapture(billing, model.modelId, model.provider);

    return result;
  };

  wrapStream: LanguageModelV3Middleware['wrapStream'] = async ({
    doStream,
    model,
  }) => {
    const { stream, ...rest } = await doStream();

    let currentId: string | undefined = undefined;
    let finalMetadata: unknown | undefined = undefined;

    const billedStream = stream.pipeThrough(
      new TransformStream<LanguageModelV3StreamPart, LanguageModelV3StreamPart>(
        {
          transform: async (chunk, controller) => {
            switch (chunk.type) {
              case 'response-metadata':
              case 'text-start':
                if (chunk.id) currentId = chunk.id;
                break;
              case 'finish':
                if (chunk.providerMetadata)
                  finalMetadata = chunk.providerMetadata;
                break;
            }
            controller.enqueue(chunk);
          },
          flush: async () => {
            const billing = await this.extractBilling(
              finalMetadata as TMetadata,
              currentId,
              model.modelId,
              model.provider,
            );

            await this.broadcastCapture(billing, model.modelId, model.provider);
          },
        },
      ),
    );

    return { ...rest, stream: billedStream };
  };
}
