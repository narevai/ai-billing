'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ModelSelectorPanel,
  ModelSelectorTrigger,
  modelSelectorWrapper,
  modelSelectorDropdown,
  type ModelOption,
} from '@ai-billing/ui';
import { useModels } from './useModels.js';

export interface ModelSelectorProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onSelect'
> {
  providers?: string[];
  staticModels?: ModelOption[];
  defaultModel?: string;
  selectedModel?: string;
  onSelect: (model: ModelOption) => void;
}

export function ModelSelector({
  providers,
  staticModels,
  defaultModel,
  selectedModel,
  onSelect,
  className,
  style,
  ...props
}: ModelSelectorProps) {
  const { models, isLoading, error } = useModels(staticModels);
  const [open, setOpen] = useState(false);
  const autoSelected = useRef(false);

  const filtered = useMemo(() => {
    if (!providers?.length) return models;
    return models.filter(m => providers.includes(m.provider));
  }, [models, providers]);

  useEffect(() => {
    if (autoSelected.current || filtered.length === 0 || selectedModel) return;
    autoSelected.current = true;
    const first = filtered.find(m => m.id === defaultModel) ?? filtered[0]!;
    onSelect(first);
  }, [filtered, selectedModel, defaultModel, onSelect]);

  const selectedModelName =
    filtered.find(m => m.id === selectedModel)?.name ??
    (selectedModel ? selectedModel.split(':').pop() : undefined);

  const triggerLabel = error
    ? 'Error loading models'
    : isLoading
      ? 'Loading models...'
      : selectedModelName;

  const cls = (className ?? '').trim();

  function handleSelect(modelId: string) {
    const model = filtered.find(m => m.id === modelId);
    if (model) {
      onSelect(model);
      setOpen(false);
    }
  }

  return (
    <div
      className={cls}
      style={{ ...modelSelectorWrapper, ...style }}
      {...props}
    >
      {open && filtered.length > 0 && (
        <div style={modelSelectorDropdown}>
          <ModelSelectorPanel
            models={filtered}
            selectedModelId={selectedModel}
            onSelect={handleSelect}
          />
        </div>
      )}
      <ModelSelectorTrigger
        modelLabel={triggerLabel}
        onClick={() => setOpen(v => !v)}
        disabled={isLoading || !!error}
      />
    </div>
  );
}
