import React, { useState } from 'react';
import {
  modelSelectorPanel,
  modelSearchField,
  modelScrollArea,
  modelGroupLabel,
  modelItemButton,
} from './chat-styles.js';

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
}

export interface ModelSelectorProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onSelect'
> {
  models: ModelOption[];
  selectedModelId?: string;
  onSelect: (modelId: string) => void;
}

function groupByProvider(models: ModelOption[]): Map<string, ModelOption[]> {
  const map = new Map<string, ModelOption[]>();
  for (const m of models) {
    const list = map.get(m.provider) ?? [];
    list.push(m);
    map.set(m.provider, list);
  }
  return map;
}

export const ModelSelector = React.forwardRef<
  HTMLDivElement,
  ModelSelectorProps
>(({ models, selectedModelId, onSelect, className, style, ...props }, ref) => {
  const [search, setSearch] = useState('');
  const cls = (className ?? '').trim();

  const q = search.trim().toLowerCase();
  const filtered = q
    ? models.filter(
        m =>
          m.name.toLowerCase().includes(q) ||
          m.provider.toLowerCase().includes(q),
      )
    : models;

  const groups = groupByProvider(filtered);

  return (
    <div
      ref={ref}
      className={cls}
      style={{ ...modelSelectorPanel, ...style }}
      {...props}
    >
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search models..."
        style={modelSearchField}
        autoFocus
      />
      <div style={modelScrollArea}>
        {Array.from(groups.entries()).map(([provider, providerModels]) => (
          <div key={provider}>
            <div style={modelGroupLabel}>{provider}</div>
            {providerModels.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelect(m.id)}
                style={{
                  ...modelItemButton,
                  background:
                    m.id === selectedModelId ? 'var(--muted)' : 'transparent',
                  fontWeight: m.id === selectedModelId ? 600 : 400,
                }}
              >
                {m.name}
              </button>
            ))}
          </div>
        ))}
        {filtered.length === 0 && (
          <div
            style={{
              padding: '16px 14px',
              fontSize: '13px',
              color: 'var(--muted-foreground)',
            }}
          >
            No models found
          </div>
        )}
      </div>
    </div>
  );
});
ModelSelector.displayName = 'ModelSelector';
