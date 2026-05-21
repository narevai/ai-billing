import React from 'react';

export function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2c0 0 .6 5.4 2.8 8.2C17.2 13 22 12 22 12s-4.8-.5-7.2 2.2C12.6 17 12 22 12 22s-.6-5-2.8-7.8C7.2 11.5 2 12 2 12s4.8.5 7.2-2.8C11.4 7 12 2 12 2z" />
    </svg>
  );
}

export function ArrowUpIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

export function StopIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

export function ModelIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" />
    </svg>
  );
}

export function LightningIcon({ selected }: { selected: boolean }) {
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'background 0.15s',
        background: selected ? 'var(--foreground)' : 'var(--muted)',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M13 2L4.5 13.5H11L10 22L20.5 10.5H14L13 2Z"
          fill={selected ? 'var(--background)' : 'var(--muted-foreground)'}
          stroke={selected ? 'var(--background)' : 'var(--muted-foreground)'}
          strokeWidth="0.5"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
