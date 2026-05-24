import React from 'react';
import { ModelIcon } from '../icons.js';
import { modelChipButton } from './chat-styles.js';

export interface ModelSelectorTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  modelLabel?: string;
}

export const ModelSelectorTrigger = React.forwardRef<
  HTMLButtonElement,
  ModelSelectorTriggerProps
>(({ modelLabel, style, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    style={{ ...modelChipButton, ...style }}
    {...props}
  >
    <ModelIcon />
    {modelLabel ?? 'Select model'}
  </button>
));
ModelSelectorTrigger.displayName = 'ModelSelectorTrigger';
