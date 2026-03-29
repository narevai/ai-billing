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
} from '../../../types/index.js';

export interface BuildV3EventPayload<TTags> {
  responseId: string | undefined;
  model: LanguageModelV3;
  usage: LanguageModelV3Usage | undefined;
  providerMetadata: SharedV3ProviderMetadata | undefined;
  tags: TTags;
}

export interface BillingMiddlewareV3Options<
  TTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  buildEvent: EventBuilder<BuildV3EventPayload<TTags>, TTags>;
}

export function createV3BillingMiddleware<TTags>(
  options: BillingMiddlewareV3Options<TTags>,
): LanguageModelV3Middleware {
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
  }): Promise<void> => {
    try {
      const rawHeader = params.headers?.['x-ai-billing-tags'];
      const headerTags = rawHeader ? JSON.parse(rawHeader) : {};

      const tags = {
        ...(defaultTags ?? {}),
        ...headerTags,
      } as TTags;

      const event = await buildEvent({
        responseId,
        model,
        usage,
        providerMetadata,
        tags,
      });

      if (event) {
        await Promise.allSettled(
          destinations.map(d => Promise.resolve(d(event))),
        );
      }
    } catch (err) {
      if (onError) onError(err);
      else console.error('[ai-billing] Core Error:', err);
    }
  };

  return {
    specificationVersion: 'v3',

    wrapGenerate: async ({ doGenerate, model, params }) => {
      const result: LanguageModelV3GenerateResult = await doGenerate();

      const promise = processEvent({
        model,
        params,
        usage: result.usage,
        providerMetadata: result.providerMetadata,
        responseId: result.response?.id,
      });

      if (waitUntil) waitUntil(promise);
      return result;
    },

    wrapStream: async ({ doStream, model, params }) => {
      const { stream, ...rest } = await doStream();

      let responseId: string | undefined;
      let usage: LanguageModelV3Usage | undefined;
      let providerMetadata: SharedV3ProviderMetadata | undefined;

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
            }
            controller.enqueue(chunk);
          },
          flush() {
            const promise = processEvent({
              model,
              params,
              usage,
              providerMetadata,
              responseId,
            });
            if (waitUntil) waitUntil(promise);
          },
        }),
      );

      return { ...rest, stream: billedStream };
    },
  };
}
