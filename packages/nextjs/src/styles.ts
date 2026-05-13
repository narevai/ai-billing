import type React from 'react';

export const cardBase: React.CSSProperties = {
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--card)',
  color: 'var(--card-foreground)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius, 0.75rem)',
  padding: '20px 24px',
};

export const heading: React.CSSProperties = {
  margin: '0 0 4px',
  fontSize: '13px',
  color: 'var(--muted-foreground)',
};

export const mutedText: React.CSSProperties = {
  margin: 0,
  fontSize: '13px',
  color: 'var(--muted-foreground)',
};

export const bigNumber: React.CSSProperties = {
  fontSize: '28px',
  fontWeight: 700,
  color: 'var(--foreground)',
  letterSpacing: '-0.5px',
};

export const subLabel: React.CSSProperties = {
  fontSize: '14px',
  color: 'var(--muted-foreground)',
};

export const barTrack: React.CSSProperties = {
  height: '6px',
  borderRadius: '3px',
  background: 'var(--muted)',
  overflow: 'hidden',
  marginBottom: '8px',
};

export const barLabels: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '12px',
  color: 'var(--muted-foreground)',
};
