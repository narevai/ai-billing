'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChatInputPanel,
  ModelSelectorPanel,
  ModelSelectorTrigger,
  modelSelectorDropdown,
  type ModelOption,
} from '@ai-billing/ui';
import { useModels } from './useModels.js';

export interface ChatInputProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onSubmit'
> {
  onSubmit: (value: string) => void;
  isLoading?: boolean;
  onStop?: () => void;
  placeholder?: string;
  disabled?: boolean;
  providers?: string[];
  staticModels?: ModelOption[];
  defaultModel?: string;
  selectedModel?: string;
  onModelSelect: (model: ModelOption) => void;
}

export function ChatInput({
  onSubmit,
  isLoading,
  onStop,
  placeholder,
  disabled,
  providers,
  staticModels,
  defaultModel,
  selectedModel,
  onModelSelect,
  className,
  style,
  ...props
}: ChatInputProps) {
  const { models, isLoading: modelsLoading, error } = useModels(staticModels);
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
    onModelSelect(first);
  }, [filtered, selectedModel, defaultModel, onModelSelect]);

  const selectedModelName =
    filtered.find(m => m.id === selectedModel)?.name ??
    (selectedModel ? selectedModel.split(':').pop() : undefined);

  const triggerLabel = error
    ? 'Error loading models'
    : modelsLoading
      ? 'Loading models...'
      : selectedModelName;

  function handlePanelSelect(modelId: string) {
    const model = filtered.find(m => m.id === modelId);
    if (model) {
      onModelSelect(model);
      setOpen(false);
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      {open && filtered.length > 0 && (
        <div style={modelSelectorDropdown}>
          <ModelSelectorPanel
            models={filtered}
            selectedModelId={selectedModel}
            onSelect={handlePanelSelect}
          />
        </div>
      )}
      <ChatInputPanel
        className={className}
        style={style}
        onSubmit={onSubmit}
        isLoading={isLoading}
        onStop={onStop}
        placeholder={placeholder}
        disabled={disabled ?? (!selectedModel && !modelsLoading)}
        leftSlot={
          <ModelSelectorTrigger
            modelLabel={triggerLabel}
            onClick={() => setOpen(v => !v)}
            disabled={modelsLoading || !!error}
          />
        }
        {...props}
      />
    </div>
  );
}
