import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3Usage,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
  LanguageModelV3Middleware,
  SharedV3ProviderMetadata,
} from '@ai-sdk/provider';
import type { BillingMiddlewareOptions } from '../../../types/index.js';

export function createV3BillingMiddleware<TCustomMeta>(
  options: BillingMiddlewareOptions<
    SharedV3ProviderMetadata,
    TCustomMeta,
    LanguageModelV3Usage
  >,
): LanguageModelV3Middleware {
  const { extractor, destinations, metadata, waitUntil, onError } = options;

  const processEvent = async (
    model: LanguageModelV3,
    params: LanguageModelV3CallOptions,
    result: {
      usage?: LanguageModelV3Usage;
      providerMetadata?: SharedV3ProviderMetadata;
      responseId?: string;
    },
  ): Promise<void> => {
    try {
      const rawHeader = params.headers?.['x-billing-context'];

      const headerMetadata = rawHeader ? JSON.parse(rawHeader) : {};
      const baseMetadata = metadata ?? {};

      const customMetadata = {
        ...baseMetadata,
        ...headerMetadata,
      } as TCustomMeta;

      const event = await extractor({
        modelId: model.modelId,
        providerId: model.provider,
        customMetadata,
        result,
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

      const promise = processEvent(model, params, {
        usage: result.usage,
        providerMetadata: result.providerMetadata,
        responseId: result.response?.id,
      });

      if (waitUntil) waitUntil(promise);
      return result;
    },

    wrapStream: async ({ doStream, model, params }) => {
      const { stream, ...rest } = await doStream();

      let usage: LanguageModelV3Usage | undefined;
      let providerMetadata: SharedV3ProviderMetadata | undefined;
      let responseId: string | undefined;

      const billedStream = stream.pipeThrough(
        new TransformStream<
          LanguageModelV3StreamPart,
          LanguageModelV3StreamPart
        >({
          transform(chunk, controller) {
            if (chunk.type === 'response-metadata') responseId = chunk.id;
            if (chunk.type === 'finish') {
              usage = chunk.usage;
              providerMetadata = chunk.providerMetadata;
            }
            controller.enqueue(chunk);
          },
          flush() {
            const promise = processEvent(model, params, {
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
