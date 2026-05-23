import React, { useEffect, useRef } from 'react';
import { messagesList, emptyState, loadingDots, dot } from './chat-styles.js';

let keyframesInjected = false;

function injectKeyframes() {
  if (keyframesInjected) return;
  keyframesInjected = true;
  if (typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.textContent =
    '@keyframes aiBillingBlink{0%,80%,100%{opacity:0.2}40%{opacity:1}}';
  document.head.appendChild(style);
}

export interface ChatMessagesPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  isLoading?: boolean;
  emptyMessage?: string;
}

function LoadingIndicator() {
  useEffect(() => {
    injectKeyframes();
  }, []);

  return (
    <div style={loadingDots}>
      {[0, 0.2, 0.4].map(delay => (
        <span
          key={delay}
          style={{
            ...dot,
            animation: 'aiBillingBlink 1.4s infinite',
            animationDelay: `${delay}s`,
          }}
        />
      ))}
    </div>
  );
}

export const ChatMessagesPanel = React.forwardRef<
  HTMLDivElement,
  ChatMessagesPanelProps
>(
  (
    {
      children,
      isLoading,
      emptyMessage = 'No messages yet.',
      className,
      style,
      ...props
    },
    ref,
  ) => {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [children, isLoading]);

    const cls = (className ?? '').trim();
    const hasContent = React.Children.count(children) > 0;

    return (
      <div
        ref={ref}
        className={cls}
        style={{ ...messagesList, ...style }}
        {...props}
      >
        {!hasContent && !isLoading ? (
          <div style={emptyState}>{emptyMessage}</div>
        ) : (
          <>
            {children}
            {isLoading && <LoadingIndicator />}
            <div ref={bottomRef} />
          </>
        )}
      </div>
    );
  },
);
ChatMessagesPanel.displayName = 'ChatMessagesPanel';
