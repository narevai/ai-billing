import React from 'react';
import { barColor, fmt } from '../utils.js';
import {
  cardBase,
  heading,
  bigNumber,
  subLabel,
  barTrack,
  barLabels,
} from '../styles.js';

export interface UsageBarProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: number;
  cap?: number;
  unit?: string;
  loading?: boolean;
}

function UsageBarSkeleton({
  label,
  unit = '$',
}: Pick<UsageBarProps, 'label' | 'unit'>) {
  const dash = '—';
  return (
    <>
      <p style={heading}>{label || dash}</p>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 6,
          margin: '0 0 14px',
        }}
      >
        <span style={bigNumber}>{unit === '$' ? '$—' : dash}</span>
        <span style={subLabel}>/ {unit === '$' ? '$—' : dash}</span>
      </div>
      <div style={barTrack}>
        <div
          style={{
            height: '100%',
            width: '0%',
            borderRadius: 3,
            background: 'var(--muted)',
          }}
        />
      </div>
      <div style={barLabels}>
        <span>—%</span>
        <span>— remaining</span>
      </div>
    </>
  );
}

function UsageBarContent({
  label,
  value,
  cap,
  unit,
}: Pick<UsageBarProps, 'label' | 'value' | 'cap' | 'unit'>) {
  const showBar = cap !== undefined;
  const pct = cap && cap > 0 ? Math.min((value / cap) * 100, 100) : 0;
  const color = barColor(pct);
  const remaining = cap ? cap - value : 0;
  const over = remaining < 0;

  return (
    <>
      <p style={heading}>{label}</p>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 6,
          margin: '0 0 14px',
        }}
      >
        <span style={bigNumber}>{fmt(value, unit)}</span>
        {showBar && <span style={subLabel}>/ {fmt(cap!, unit)}</span>}
      </div>
      {showBar && (
        <>
          <div style={barTrack}>
            <div
              style={{
                height: '100%',
                width: `${pct}%`,
                borderRadius: 3,
                background: color,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <div style={barLabels}>
            <span>
              {pct.toFixed(0)}% used{over ? ' (over)' : ''}
            </span>
            <span>
              {over
                ? `${fmt(Math.abs(remaining), unit)} over`
                : `${fmt(remaining, unit)} remaining`}
            </span>
          </div>
        </>
      )}
    </>
  );
}

export const UsageBar = React.forwardRef<HTMLDivElement, UsageBarProps>(
  (
    { label, value, cap, unit = '$', loading, className, style, ...props },
    ref,
  ) => {
    const cls = (className ?? '').trim();

    return (
      <div
        ref={ref}
        className={cls}
        style={{ ...cardBase, ...style }}
        {...props}
      >
        {loading ? (
          <UsageBarSkeleton label={label} unit={unit} />
        ) : (
          <UsageBarContent label={label} value={value} cap={cap} unit={unit} />
        )}
      </div>
    );
  },
);
UsageBar.displayName = 'UsageBar';
