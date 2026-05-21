import React, { useCallback, useState } from 'react';
import { ArrowUpIcon, StopIcon, ModelIcon } from '../icons.js';
import {
  inputCard,
  inputCardTextarea,
  inputCardBottom,
  modelChipButton,
  sendCircle,
  stopCircle,
} from './chat-styles.js';

export interface ChatInputProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onSubmit'
> {
  onSubmit: (value: string) => void;
  isLoading?: boolean;
  onStop?: () => void;
  placeholder?: string;
  disabled?: boolean;
  modelLabel?: string;
  onModelClick?: () => void;
}

export const ChatInput = React.forwardRef<HTMLDivElement, ChatInputProps>(
  (
    {
      onSubmit,
      isLoading,
      onStop,
      placeholder = 'Type a message...',
      disabled,
      modelLabel,
      onModelClick,
      className,
      style,
      ...props
    },
    ref,
  ) => {
    const [value, setValue] = useState('');

    const handleSubmit = useCallback(() => {
      const trimmed = value.trim();
      if (!trimmed || isLoading || disabled) return;
      onSubmit(trimmed);
      setValue('');
    }, [value, isLoading, disabled, onSubmit]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSubmit();
        }
      },
      [handleSubmit],
    );

    const cls = (className ?? '').trim();
    const canSend = !disabled && !!value.trim() && !isLoading;

    return (
      <div
        ref={ref}
        className={cls}
        style={{ ...inputCard, ...style }}
        {...props}
      >
        <textarea
          value={value}
          onChange={e => {
            setValue(e.target.value);
            e.currentTarget.style.height = 'auto';
            e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
          }}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Loading models...' : placeholder}
          disabled={disabled}
          rows={1}
          style={inputCardTextarea}
        />
        <div style={inputCardBottom}>
          {modelLabel ? (
            <button
              type="button"
              onClick={onModelClick}
              style={modelChipButton}
            >
              <ModelIcon />
              {modelLabel}
            </button>
          ) : (
            <div />
          )}
          {isLoading ? (
            <button
              type="button"
              onClick={onStop}
              style={stopCircle}
              aria-label="Stop generating"
            >
              <StopIcon />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSend}
              style={{
                ...sendCircle,
                opacity: canSend ? 1 : 0.3,
                cursor: canSend ? 'pointer' : 'default',
              }}
              aria-label="Send message"
            >
              <ArrowUpIcon />
            </button>
          )}
        </div>
      </div>
    );
  },
);
ChatInput.displayName = 'ChatInput';
