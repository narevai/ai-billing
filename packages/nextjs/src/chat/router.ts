import { wrapLanguageModel, createGateway } from 'ai';
import type { LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createGroq } from '@ai-sdk/groq';
import { createXai } from '@ai-sdk/xai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAIMiddleware } from '@ai-billing/openai';
import { createAnthropicMiddleware } from '@ai-billing/anthropic';
import { createGoogleMiddleware } from '@ai-billing/google';
import { createDeepSeekMiddleware } from '@ai-billing/deepseek';
import { createGroqMiddleware } from '@ai-billing/groq';
import { createXaiMiddleware } from '@ai-billing/xai';
import { createChutesMiddleware } from '@ai-billing/chutes';
import { createMinimaxMiddleware } from '@ai-billing/minimax';
import { createOpenRouterV3Middleware } from '@ai-billing/openrouter';
import { createGatewayMiddleware } from '@ai-billing/gateway';
import { createPolarDestination } from '@ai-billing/polar';
import { createNarevPriceResolver } from '@ai-billing/narev';
import type {
  PriceResolver,
  Destination,
  DefaultTags,
} from '@ai-billing/types';
import { getNarevClient } from '../narev-client.js';
import { DEFAULT_MODELS, buildModelOptions } from './models.js';
import type { ModelOption } from '@ai-billing/ui';

export interface ChatRouterOptions {
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

export type ChatRouter = Awaited<ReturnType<typeof createChatRouter>>;

function resolveEnv(
  key: string,
  customEnv?: Record<string, string | undefined>,
): string | undefined {
  if (customEnv && key in customEnv) return customEnv[key];
  return process.env[key];
}

/**
 * Creates and initialises the chat router with all configured providers.
 * Providers are enabled automatically when their API key env var is set.
 *
 * @param options - Router configuration; see {@link ChatRouterOptions}.
 */
export async function createChatRouter(
  options: ChatRouterOptions = {},
): Promise<{
  getProviders: () => ProviderEntry[];
  getModels: () => ModelOption[];
  getModel: (modelId: string) => LanguageModel;
}> {
  const env = options.env;
  const modelOverrides = { ...DEFAULT_MODELS, ...options.models };

  const polarAccessToken =
    options.polarAccessToken ?? resolveEnv('POLAR_ACCESS_TOKEN', env);
  const polarServer =
    options.polarServer ??
    (resolveEnv('POLAR_SERVER', env) as 'sandbox' | 'production' | undefined) ??
    'sandbox';
  const destinations: Destination<DefaultTags>[] = polarAccessToken
    ? [
        createPolarDestination({
          accessToken: polarAccessToken,
          server: polarServer,
          eventName: 'llm_usage',
          externalCustomerIdKey: 'userId' as never,
        }),
      ]
    : [];

  const narevApiKey = options.narevApiKey ?? resolveEnv('NAREV_API_KEY', env);
  const priceResolver: PriceResolver | undefined = narevApiKey
    ? createNarevPriceResolver({ apiKey: narevApiKey })
    : undefined;

  const providers: ProviderEntry[] = [];
  const providerMap = new Map<string, ProviderEntry>();

  function add(
    providerId: string,
    getModel: (modelId: string) => LanguageModel,
    models: string[],
  ) {
    const entry: ProviderEntry = {
      providerId,
      getModel,
      models: buildModelOptions(providerId, models),
    };
    providers.push(entry);
    providerMap.set(providerId, entry);
  }

  if (priceResolver) {
    const openaiKey = resolveEnv('OPENAI_API_KEY', env);
    if (openaiKey) {
      const p = createOpenAI({ apiKey: openaiKey });
      const m = createOpenAIMiddleware({ priceResolver, destinations });
      add(
        'openai',
        id => wrapLanguageModel({ model: p(id), middleware: m }),
        modelOverrides.openai ?? [],
      );
    }

    const anthropicKey = resolveEnv('ANTHROPIC_API_KEY', env);
    if (anthropicKey) {
      const p = createAnthropic({ apiKey: anthropicKey });
      const m = createAnthropicMiddleware({ priceResolver, destinations });
      add(
        'anthropic',
        id => wrapLanguageModel({ model: p(id), middleware: m }),
        modelOverrides.anthropic ?? [],
      );
    }

    const googleKey = resolveEnv('GOOGLE_AI_STUDIO_KEY', env);
    if (googleKey) {
      const p = createGoogleGenerativeAI({ apiKey: googleKey });
      const m = createGoogleMiddleware({ priceResolver, destinations });
      add(
        'google',
        id => wrapLanguageModel({ model: p(id), middleware: m }),
        modelOverrides.google ?? [],
      );
    }

    const deepseekKey = resolveEnv('DEEPSEEK_API_KEY', env);
    if (deepseekKey) {
      const p = createDeepSeek({ apiKey: deepseekKey });
      const m = createDeepSeekMiddleware({ priceResolver, destinations });
      add(
        'deepseek',
        id => wrapLanguageModel({ model: p(id), middleware: m }),
        modelOverrides.deepseek ?? [],
      );
    }

    const groqKey = resolveEnv('GROQ_API_KEY', env);
    if (groqKey) {
      const p = createGroq({ apiKey: groqKey });
      const m = createGroqMiddleware({ priceResolver, destinations });
      add(
        'groq',
        id => wrapLanguageModel({ model: p(id), middleware: m }),
        modelOverrides.groq ?? [],
      );
    }

    const xaiKey = resolveEnv('XAI_API_KEY', env);
    if (xaiKey) {
      const p = createXai({ apiKey: xaiKey });
      const m = createXaiMiddleware({ priceResolver, destinations });
      add(
        'xai',
        id => wrapLanguageModel({ model: p(id), middleware: m }),
        modelOverrides.xai ?? [],
      );
    }

    const chutesKey = resolveEnv('CHUTES_API_KEY', env);
    if (chutesKey) {
      const p = createOpenAICompatible({
        name: 'chutes',
        baseURL: 'https://llm.chutes.ai/v1',
        apiKey: chutesKey,
      });
      const m = createChutesMiddleware({ priceResolver, destinations });
      add(
        'chutes',
        id => wrapLanguageModel({ model: p(id), middleware: m }),
        modelOverrides.chutes ?? [],
      );
    }

    const minimaxKey = resolveEnv('MINIMAX_API_KEY', env);
    if (minimaxKey) {
      const p = createAnthropic({
        apiKey: minimaxKey,
        baseURL: 'https://api.minimax.io/anthropic/v1',
      });
      const m = createMinimaxMiddleware({ priceResolver, destinations });
      add(
        'minimax',
        id => wrapLanguageModel({ model: p(id), middleware: m }),
        modelOverrides.minimax ?? [],
      );
    }
  }

  const openrouterKey = resolveEnv('OPENROUTER_API_KEY', env);
  if (openrouterKey) {
    const p = createOpenRouter({ apiKey: openrouterKey });
    const m = createOpenRouterV3Middleware({ destinations });
    add(
      'openrouter',
      id => wrapLanguageModel({ model: p(id), middleware: m }),
      modelOverrides.openrouter ?? [],
    );
  }

  const gatewayKey = resolveEnv('AI_GATEWAY_API_KEY', env);
  if (gatewayKey) {
    const p = createGateway({ apiKey: gatewayKey });
    const m = createGatewayMiddleware({ destinations });
    add(
      'gateway',
      id => wrapLanguageModel({ model: p(id), middleware: m }),
      modelOverrides.gateway ?? [],
    );
  }

  let allModels: ModelOption[] = providers.flatMap(p => p.models);
  if (narevApiKey && providers.length > 0) {
    try {
      const narevClient = getNarevClient();
      const configuredProviderIds = providers.map(p => p.providerId).join(',');
      const { data } = await narevClient.listModels({
        provider_id: configuredProviderIds,
        page_size: 1000,
      });
      const byProvider: Record<string, string[]> = {};
      for (const { provider_id, model_id } of data) {
        (byProvider[provider_id] ??= []).push(model_id);
      }
      allModels = Object.entries(byProvider).flatMap(([pid, ids]) => {
        if (!providerMap.has(pid)) return [];
        return buildModelOptions(pid, ids);
      });
    } catch {
      // fall back to DEFAULT_MODELS list
    }
  }

  return {
    getProviders: () => providers,
    getModels: () => allModels,
    getModel: (modelId: string) => {
      const separatorIndex = modelId.indexOf(':');
      const providerId = modelId.slice(0, separatorIndex);
      const modelName = modelId.slice(separatorIndex + 1);
      const entry = providerMap.get(providerId);
      if (!entry) throw new Error(`Provider not configured: ${providerId}`);
      return entry.getModel(modelName);
    },
  };
}
