'use client';

import { useState, useEffect } from 'react';
import type { ModelOption } from '@ai-billing/ui';
import { getModels } from './server-actions.js';

export interface UseModelsResult {
  models: ModelOption[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Fetches available models from the gateway (Narev when configured, otherwise
 * the built-in DEFAULT_MODELS list filtered to configured providers).
 *
 * Pass `staticModels` to skip fetching and use a fixed list instead.
 * @param staticModels - Optional fixed list of models; skips the server fetch when provided.
 */
export function useModels(staticModels?: ModelOption[]): UseModelsResult {
  const [models, setModels] = useState<ModelOption[]>(staticModels ?? []);
  const [isLoading, setIsLoading] = useState(!staticModels);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (staticModels) {
      setModels(staticModels);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    getModels()
      .then(list => {
        if (cancelled) return;
        setModels(list);
        setError(null);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load models');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [staticModels]);

  return { models, isLoading, error };
}
