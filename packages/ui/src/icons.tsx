import React from 'react';

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
