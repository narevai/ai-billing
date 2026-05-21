import { wrapLanguageModel } from 'ai';
import type { LanguageModel } from 'ai';
import { createPolarDestination } from '@ai-billing/polar';
import {
  createNarevPriceResolver,
  type PriceResolver,
  type Destination,
  type DefaultTags,
} from '@ai-billing/core';
import { getNarevClient } from '../narev-client.js';
import { DEFAULT_MODELS, buildModelOptions } from './models.js';
import type { ModelOption } from '@ai-billing/ui';

export interface ChatGatewayOptions {
  models?: Record<string, string[]>;
  tags?: Record<string, string>;
  polarAccessToken?: string;
  polarServer?: 'sandbox' | 'production';
  narevApiKey?: string;
  env?: Record<string, string | undefined>;
}

interface ProviderEntry {
  providerId: string;
  getModel: (modelId: string) => LanguageModel;
  models: ModelOption[];
}

export type ChatGateway = Awaited<ReturnType<typeof createChatGateway>>;

async function createPolarDestinationIfConfigured(
  token?: string,
  server?: 'sandbox' | 'production',
): Promise<Destination<DefaultTags> | null> {
  const accessToken = token ?? process.env.POLAR_ACCESS_TOKEN;
  if (!accessToken) return null;
  const polarServer =
    server ??
    (process.env.POLAR_SERVER as 'sandbox' | 'production' | undefined) ??
    'sandbox';
  return createPolarDestination({
    accessToken,
    server: polarServer,
    eventName: 'llm_usage',
    externalCustomerIdKey: 'userId' as never,
  });
}

async function trySetupOpenAI(
  apiKey: string,
  priceResolver?: PriceResolver,
  destinations?: Destination[],
): Promise<{ getModel: (modelId: string) => LanguageModel } | null> {
  try {
    const [{ createOpenAI }, { createOpenAIMiddleware }] = await Promise.all([
      import('@ai-sdk/openai'),
      import('@ai-billing/openai'),
    ]);
    const provider = createOpenAI({ apiKey });
    const middleware = createOpenAIMiddleware({
      priceResolver: priceResolver!,
      destinations,
    });
    return {
      getModel: (modelId: string) =>
        wrapLanguageModel({ model: provider(modelId), middleware }),
    };
  } catch (error) {
    console.warn(
      '[ai-billing] Failed to set up OpenAI provider:',
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

async function trySetupAnthropic(
  apiKey: string,
  priceResolver?: PriceResolver,
  destinations?: Destination[],
): Promise<{ getModel: (modelId: string) => LanguageModel } | null> {
  try {
    const [{ createAnthropic }, { createAnthropicMiddleware }] =
      await Promise.all([
        import('@ai-sdk/anthropic'),
        import('@ai-billing/anthropic'),
      ]);
    const provider = createAnthropic({ apiKey });
    const middleware = createAnthropicMiddleware({
      priceResolver: priceResolver!,
      destinations,
    });
    return {
      getModel: (modelId: string) =>
        wrapLanguageModel({ model: provider(modelId), middleware }),
    };
  } catch (error) {
    console.warn('[ai-billing] Failed to set up Anthropic provider:', error);
    return null;
  }
}

async function trySetupGoogle(
  apiKey: string,
  priceResolver?: PriceResolver,
  destinations?: Destination[],
): Promise<{ getModel: (modelId: string) => LanguageModel } | null> {
  try {
    const [{ createGoogleGenerativeAI }, { createGoogleMiddleware }] =
      await Promise.all([
        import('@ai-sdk/google'),
        import('@ai-billing/google'),
      ]);
    const provider = createGoogleGenerativeAI({ apiKey });
    const middleware = createGoogleMiddleware({
      priceResolver: priceResolver!,
      destinations,
    });
    return {
      getModel: (modelId: string) =>
        wrapLanguageModel({ model: provider(modelId), middleware }),
    };
  } catch (error) {
    console.warn('[ai-billing] Failed to set up Google provider:', error);
    return null;
  }
}

async function trySetupDeepSeek(
  apiKey: string,
  priceResolver?: PriceResolver,
  destinations?: Destination[],
): Promise<{ getModel: (modelId: string) => LanguageModel } | null> {
  try {
    const [{ createDeepSeek }, { createDeepSeekMiddleware }] =
      await Promise.all([
        import('@ai-sdk/deepseek'),
        import('@ai-billing/deepseek'),
      ]);
    const provider = createDeepSeek({ apiKey });
    const middleware = createDeepSeekMiddleware({
      priceResolver: priceResolver!,
      destinations,
    });
    return {
      getModel: (modelId: string) =>
        wrapLanguageModel({ model: provider(modelId), middleware }),
    };
  } catch (error) {
    console.warn('[ai-billing] Failed to set up DeepSeek provider:', error);
    return null;
  }
}

async function trySetupGroq(
  apiKey: string,
  priceResolver?: PriceResolver,
  destinations?: Destination[],
): Promise<{ getModel: (modelId: string) => LanguageModel } | null> {
  try {
    const [{ createGroq }, { createGroqMiddleware }] = await Promise.all([
      import('@ai-sdk/groq'),
      import('@ai-billing/groq'),
    ]);
    const provider = createGroq({ apiKey });
    const middleware = createGroqMiddleware({
      priceResolver: priceResolver!,
      destinations,
    });
    return {
      getModel: (modelId: string) =>
        wrapLanguageModel({ model: provider(modelId), middleware }),
    };
  } catch (error) {
    console.warn('[ai-billing] Failed to set up Groq provider:', error);
    return null;
  }
}

async function trySetupXai(
  apiKey: string,
  priceResolver?: PriceResolver,
  destinations?: Destination[],
): Promise<{ getModel: (modelId: string) => LanguageModel } | null> {
  try {
    const [{ createXai }, { createXaiMiddleware }] = await Promise.all([
      import('@ai-sdk/xai'),
      import('@ai-billing/xai'),
    ]);
    const provider = createXai({ apiKey });
    const middleware = createXaiMiddleware({
      priceResolver: priceResolver!,
      destinations,
    });
    return {
      getModel: (modelId: string) =>
        wrapLanguageModel({ model: provider(modelId), middleware }),
    };
  } catch (error) {
    console.warn('[ai-billing] Failed to set up xAI provider:', error);
    return null;
  }
}

async function trySetupChutes(
  apiKey: string,
  priceResolver?: PriceResolver,
  destinations?: Destination[],
): Promise<{ getModel: (modelId: string) => LanguageModel } | null> {
  try {
    const [{ createOpenAICompatible }, { createChutesMiddleware }] =
      await Promise.all([
        import('@ai-sdk/openai-compatible'),
        import('@ai-billing/chutes'),
      ]);
    const provider = createOpenAICompatible({
      name: 'chutes',
      baseURL: 'https://llm.chutes.ai/v1',
      apiKey,
    });
    const middleware = createChutesMiddleware({
      priceResolver: priceResolver!,
      destinations,
    });
    return {
      getModel: (modelId: string) =>
        wrapLanguageModel({ model: provider(modelId), middleware }),
    };
  } catch (error) {
    console.warn('[ai-billing] Failed to set up Chutes provider:', error);
    return null;
  }
}

async function trySetupMiniMax(
  apiKey: string,
  priceResolver?: PriceResolver,
  destinations?: Destination[],
): Promise<{ getModel: (modelId: string) => LanguageModel } | null> {
  try {
    const [{ createAnthropic }, { createMinimaxMiddleware }] =
      await Promise.all([
        import('@ai-sdk/anthropic'),
        import('@ai-billing/minimax'),
      ]);
    const provider = createAnthropic({
      apiKey,
      baseURL: 'https://api.minimax.io/anthropic/v1',
    });
    const middleware = createMinimaxMiddleware({
      priceResolver: priceResolver!,
      destinations,
    });
    return {
      getModel: (modelId: string) =>
        wrapLanguageModel({ model: provider(modelId), middleware }),
    };
  } catch (error) {
    console.warn('[ai-billing] Failed to set up MiniMax provider:', error);
    return null;
  }
}

async function trySetupOpenRouter(
  apiKey: string,
  destinations?: Destination[],
): Promise<{ getModel: (modelId: string) => LanguageModel } | null> {
  try {
    const [{ createOpenRouter }, { createOpenRouterV3Middleware }] =
      await Promise.all([
        import('@openrouter/ai-sdk-provider'),
        import('@ai-billing/openrouter'),
      ]);
    const provider = createOpenRouter({ apiKey });
    const middleware = createOpenRouterV3Middleware({ destinations });
    return {
      getModel: (modelId: string) =>
        wrapLanguageModel({ model: provider(modelId), middleware }),
    };
  } catch (error) {
    console.warn('[ai-billing] Failed to set up OpenRouter provider:', error);
    return null;
  }
}

async function trySetupGateway(
  apiKey: string,
  destinations?: Destination[],
): Promise<{ getModel: (modelId: string) => LanguageModel } | null> {
  try {
    const [{ createGateway }, { createGatewayMiddleware }] = await Promise.all([
      import('ai'),
      import('@ai-billing/gateway'),
    ]);
    const provider = createGateway({ apiKey });
    const middleware = createGatewayMiddleware({ destinations });
    return {
      getModel: (modelId: string) =>
        wrapLanguageModel({ model: provider(modelId), middleware }),
    };
  } catch (error) {
    console.warn('[ai-billing] Failed to set up AI Gateway provider:', error);
    return null;
  }
}

type ProviderSetupFn = (
  apiKey: string,
  priceResolver?: PriceResolver,
  destinations?: Destination[],
) => Promise<{ getModel: (modelId: string) => LanguageModel } | null>;

type ProviderSetupFnNoPricing = (
  apiKey: string,
  destinations?: Destination[],
) => Promise<{ getModel: (modelId: string) => LanguageModel } | null>;

interface ProviderConfig {
  providerId: string;
  envVar: string;
  models: string[];
  setup: ProviderSetupFn | ProviderSetupFnNoPricing;
  usesPriceResolver: boolean;
}

function resolveEnv(
  key: string,
  customEnv?: Record<string, string | undefined>,
): string | undefined {
  if (customEnv && key in customEnv) return customEnv[key];
  return process.env[key];
}

function getProviderConfigs(
  modelsOverride?: Record<string, string[]>,
): ProviderConfig[] {
  const models = { ...DEFAULT_MODELS, ...modelsOverride };
  return [
    {
      providerId: 'openai',
      envVar: 'OPENAI_API_KEY',
      models: models.openai ?? [],
      setup: trySetupOpenAI as ProviderSetupFn,
      usesPriceResolver: true,
    },
    {
      providerId: 'anthropic',
      envVar: 'ANTHROPIC_API_KEY',
      models: models.anthropic ?? [],
      setup: trySetupAnthropic as ProviderSetupFn,
      usesPriceResolver: true,
    },
    {
      providerId: 'google',
      envVar: 'GOOGLE_AI_STUDIO_KEY',
      models: models.google ?? [],
      setup: trySetupGoogle as ProviderSetupFn,
      usesPriceResolver: true,
    },
    {
      providerId: 'deepseek',
      envVar: 'DEEPSEEK_API_KEY',
      models: models.deepseek ?? [],
      setup: trySetupDeepSeek as ProviderSetupFn,
      usesPriceResolver: true,
    },
    {
      providerId: 'groq',
      envVar: 'GROQ_API_KEY',
      models: models.groq ?? [],
      setup: trySetupGroq as ProviderSetupFn,
      usesPriceResolver: true,
    },
    {
      providerId: 'xai',
      envVar: 'XAI_API_KEY',
      models: models.xai ?? [],
      setup: trySetupXai as ProviderSetupFn,
      usesPriceResolver: true,
    },
    {
      providerId: 'chutes',
      envVar: 'CHUTES_API_KEY',
      models: models.chutes ?? [],
      setup: trySetupChutes as ProviderSetupFn,
      usesPriceResolver: true,
    },
    {
      providerId: 'minimax',
      envVar: 'MINIMAX_API_KEY',
      models: models.minimax ?? [],
      setup: trySetupMiniMax as ProviderSetupFn,
      usesPriceResolver: true,
    },
    {
      providerId: 'openrouter',
      envVar: 'OPENROUTER_API_KEY',
      models: models.openrouter ?? [],
      setup: trySetupOpenRouter as ProviderSetupFnNoPricing,
      usesPriceResolver: false,
    },
    {
      providerId: 'gateway',
      envVar: 'AI_GATEWAY_API_KEY',
      models: models.gateway ?? [],
      setup: trySetupGateway as ProviderSetupFnNoPricing,
      usesPriceResolver: false,
    },
  ];
}

export async function createChatGateway(
  options: ChatGatewayOptions = {},
): Promise<{
  getProviders: () => ProviderEntry[];
  getModels: () => ModelOption[];
  getModel: (modelId: string) => LanguageModel;
}> {
  const customEnv = options.env;
  const configs = getProviderConfigs(options.models);

  const polarDestination = await createPolarDestinationIfConfigured(
    options.polarAccessToken,
    options.polarServer,
  );
  const destinations: Destination[] = polarDestination
    ? [polarDestination]
    : [];

  const narevApiKey = options.narevApiKey ?? process.env.NAREV_API_KEY;
  const priceResolver: PriceResolver | undefined = narevApiKey
    ? createNarevPriceResolver({ apiKey: narevApiKey })
    : undefined;

  const providers: ProviderEntry[] = [];
  const modelMap = new Map<string, ProviderEntry>();

  for (const config of configs) {
    const apiKey = resolveEnv(config.envVar, customEnv);
    if (!apiKey) continue;

    if (config.usesPriceResolver && !priceResolver) continue;

    let result;
    if (config.usesPriceResolver) {
      result = await (config.setup as ProviderSetupFn)(
        apiKey,
        priceResolver,
        destinations,
      );
    } else {
      result = await (config.setup as ProviderSetupFnNoPricing)(
        apiKey,
        destinations,
      );
    }

    if (!result) continue;

    const entry: ProviderEntry = {
      providerId: config.providerId,
      getModel: result.getModel,
      models: buildModelOptions(config.providerId, config.models),
    };

    providers.push(entry);
    for (const m of entry.models) {
      modelMap.set(m.id, entry);
    }
  }

  // Try to fetch the full model list from Narev, filtered to configured providers only.
  let allModels: ModelOption[] = providers.flatMap(p => p.models);
  console.log(
    '[ai-billing] narevApiKey set:',
    !!narevApiKey,
    '| configured providers:',
    providers.map(p => p.providerId),
  );
  if (narevApiKey && providers.length > 0) {
    try {
      const narevClient = getNarevClient();
      const configuredProviderIds = providers.map(p => p.providerId).join(',');
      console.log(
        '[ai-billing] fetching models from Narev for providers:',
        configuredProviderIds,
      );
      const { data } = await narevClient.getProviderModels({
        providers: configuredProviderIds,
      });
      console.log(
        '[ai-billing] Narev returned providers:',
        Object.keys(data),
        '| total models:',
        Object.values(data).flat().length,
      );
      allModels = Object.entries(data).flatMap(([providerId, modelIds]) => {
        const providerEntry = providers.find(p => p.providerId === providerId);
        if (!providerEntry) {
          console.log(
            '[ai-billing] Narev returned provider not in gateway, skipping:',
            providerId,
          );
          return [];
        }
        const options = buildModelOptions(providerId, modelIds);
        for (const m of options) {
          modelMap.set(m.id, providerEntry);
        }
        return options;
      });
      console.log('[ai-billing] using Narev models, count:', allModels.length);
    } catch (err) {
      console.warn(
        '[ai-billing] Narev getProviderModels failed, falling back to DEFAULT_MODELS:',
        err,
      );
    }
  } else {
    console.log(
      '[ai-billing] skipping Narev fetch, using DEFAULT_MODELS fallback',
    );
  }

  return {
    getProviders: () => providers,
    getModels: () => allModels,
    getModel: (modelId: string) => {
      const entry = modelMap.get(modelId);
      if (!entry) throw new Error(`Model not found: ${modelId}`);
      const modelName = modelId.split('/').slice(1).join('/');
      return entry.getModel(modelName);
    },
  };
}
