import React from 'react';
import {
  emptyCenterWrap,
  emptyHeroTitle,
  emptyHeroSubtitle,
  promptsGrid,
  promptCardBtn,
  emptyState,
} from './chat-styles.js';

export interface ChatEmptyStateProps {
  title?: string;
  subtitle?: string;
  emptyMessage?: string;
  prompts?: string[];
  onPromptClick?: (prompt: string) => void;
}

const DEFAULT_TITLE = 'What can I help with?';
const DEFAULT_SUBTITLE = 'Ask a question, write code, or explore ideas.';
const DEFAULT_PROMPTS = [
  'What are the advantages of using Next.js?',
  "Write code to demonstrate Dijkstra's algorithm",
  'Help me write an essay about Silicon Valley',
  'What is the weather in San Francisco?',
];

export function ChatEmptyState({
  title = DEFAULT_TITLE,
  subtitle = DEFAULT_SUBTITLE,
  emptyMessage,
  prompts = DEFAULT_PROMPTS,
  onPromptClick,
}: ChatEmptyStateProps) {
  if (!title && !subtitle && !prompts?.length) {
    return <div style={emptyState}>{emptyMessage ?? 'No messages yet.'}</div>;
  }

  return (
    <div style={emptyCenterWrap}>
      {(title || subtitle) && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {title && <h2 style={emptyHeroTitle}>{title}</h2>}
          {subtitle && <p style={emptyHeroSubtitle}>{subtitle}</p>}
        </div>
      )}
      {prompts && prompts.length > 0 && (
        <div style={promptsGrid}>
          {prompts.slice(0, 4).map((p, i) => (
            <button
              key={i}
              type="button"
              style={promptCardBtn}
              onClick={() => onPromptClick?.(p)}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
