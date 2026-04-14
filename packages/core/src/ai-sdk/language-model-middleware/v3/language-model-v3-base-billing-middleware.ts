import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3Usage,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
  LanguageModelV3Middleware,
  SharedV3ProviderMetadata,
} from '@ai-sdk/provider';
import type {
  BaseBillingMiddlewareOptions,
  EventBuilder,
  BillingEvent,
  DefaultTags,
} from '../../../types/index.js';
import { toJSONObject } from '../../../event/index.js';

export interface BuildV3EventPayload<TTags extends DefaultTags = DefaultTags> {
  responseId: string | undefined;
  model: LanguageModelV3;
  usage: LanguageModelV3Usage | undefined;
  providerMetadata: SharedV3ProviderMetadata | undefined;
  tags: TTags;
}

export interface BillingMiddlewareV3Options<
  TTags extends DefaultTags = DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  buildEvent: EventBuilder<BuildV3EventPayload<TTags>, TTags>;
}

/**
 * Creates a billing middleware for the Language Model V3 API.
 * @param options The options for the billing middleware.
 * @returns The billing middleware.
 */
export function createV3BillingMiddleware<
  TTags extends DefaultTags = DefaultTags,
>(options: BillingMiddlewareV3Options<TTags>): LanguageModelV3Middleware {
  const { buildEvent, destinations, defaultTags, waitUntil, onError } = options;

  const processEvent = async ({
    model,
    params,
    usage,
    providerMetadata,
    responseId,
  }: {
    model: LanguageModelV3;
    params: LanguageModelV3CallOptions;
    usage: LanguageModelV3Usage | undefined;
    providerMetadata: SharedV3ProviderMetadata | undefined;
    responseId: string | undefined;
  }): Promise<BillingEvent<TTags> | null> => {
    try {
      const requestTags = params.providerOptions?.['ai-billing-tags'];

      const tags = {
        ...(defaultTags ?? {}),
        ...(requestTags ?? {}),
      } as TTags;

      const event = await buildEvent({
        responseId,
        model,
        usage,
        providerMetadata,
        tags,
      });

      if (event && destinations && destinations?.length > 0) {
        const dispatchDestinationsPromise = Promise.allSettled(
          destinations.map(d => Promise.resolve(d(event))),
        );
        if (waitUntil) waitUntil(dispatchDestinationsPromise);
      }
      return event;
    } catch (err) {
      if (onError) onError(err);
      else console.error('[ai-billing] Core Error:', err);
      return null;
    }
  };

  return {
    specificationVersion: 'v3',

    wrapGenerate: async ({ doGenerate, model, params }) => {
      const result: LanguageModelV3GenerateResult = await doGenerate();

      const event = await processEvent({
        model,
        params,
        usage: result.usage,
        providerMetadata: result.providerMetadata,
        responseId: result.response?.id,
      });

      const providerMetadataWithBilling = {
        ...result.providerMetadata,
      } as SharedV3ProviderMetadata;

      if (event) {
        providerMetadataWithBilling['ai-billing'] = toJSONObject(event);
      }

      return {
        ...result,
        providerMetadata: providerMetadataWithBilling,
      };
    },

    wrapStream: async ({ doStream, model, params }) => {
      const { stream, ...rest } = await doStream();

      let responseId: string | undefined;
      let usage: LanguageModelV3Usage | undefined;
      let providerMetadata: SharedV3ProviderMetadata | undefined;
      let finishChunk:
        | Extract<LanguageModelV3StreamPart, { type: 'finish' }>
        | undefined;

      const billedStream = stream.pipeThrough(
        new TransformStream<
          LanguageModelV3StreamPart,
          LanguageModelV3StreamPart
        >({
          transform(chunk, controller) {
            if (chunk.type === 'text-start') responseId = chunk.id;
            if (chunk.type === 'response-metadata' && !responseId) {
              responseId = chunk.id;
            }
            if (chunk.type === 'finish') {
              usage = chunk.usage;
              providerMetadata = chunk.providerMetadata;
              finishChunk = chunk;
              return; // held until flush
            }
            controller.enqueue(chunk);
          },
          async flush(controller) {
            const event = await processEvent({
              model,
              params,
              usage,
              providerMetadata,
              responseId,
            });

            const providerMetadataWithBilling = {
              ...providerMetadata,
            } as SharedV3ProviderMetadata;

            if (event) {
              providerMetadataWithBilling['ai-billing'] = toJSONObject(event);
            }

            if (finishChunk) {
              controller.enqueue({
                ...finishChunk,
                providerMetadata: providerMetadataWithBilling,
              });
            }
          },
        }),
      );

      return { ...rest, stream: billedStream };
    },
  };
}
