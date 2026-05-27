import React, { useState } from 'react';
import { cardBase } from './styles.js';
import { formatCents, taxMessages } from '../utils.js';
import type { CreditPackage } from '../types.js';
import { EmptyMessage } from '../empty.js';

const loadingPackages: CreditPackage[] = [
  { id: '_1', credits: 0, priceCents: 0 },
  { id: '_2', credits: 0, priceCents: 0 },
  { id: '_3', credits: 0, priceCents: 0 },
  { id: '_4', credits: 0, priceCents: 0 },
  { id: '_5', credits: 0, priceCents: 0 },
];

export interface CreditPackagePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  packages: CreditPackage[];
  taxBehavior?: 'inclusive' | 'exclusive' | 'location';
  onPurchase: (packageId: string) => void;
  isPending?: boolean;
  error?: string | null;
  loading?: boolean;
  /** Show the Auto Top-up toggle section. */
  showAutoTopUp?: boolean;
  /** Called when the Auto Top-up toggle is switched. */
  onAutoTopUpChange?: (enabled: boolean) => void;
}

function PackageTile({
  pkg,
  disabled,
  onSelect,
}: {
  pkg: CreditPackage;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={disabled ? undefined : 0}
      onClick={disabled ? undefined : onSelect}
      onKeyDown={e => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) onSelect();
      }}
      style={{
        flex: '1 1 0',
        minWidth: 0,
        padding: '20px 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius, 0.75rem)',
        border: '1px solid var(--border)',
        background: 'transparent',
        cursor: disabled ? undefined : 'pointer',
        transition: 'background 0.15s, border-color 0.15s',
        userSelect: 'none',
        outline: 'none',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <span
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--card-foreground)',
        }}
      >
        {disabled ? '$—' : formatCents(pkg.priceCents)}
      </span>
    </div>
  );
}

function AutoTopUpSection({
  onChange,
}: {
  onChange?: (enabled: boolean) => void;
}) {
  const [enabled, setEnabled] = useState(false);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    onChange?.(next);
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 8,
        }}
      >
        <button
          role="switch"
          aria-checked={enabled}
          onClick={toggle}
          style={{
            position: 'relative',
            width: 44,
            height: 24,
            borderRadius: 12,
            border: 'none',
            background: enabled
              ? 'var(--primary, #6366f1)'
              : 'var(--muted, #3f3f46)',
            cursor: 'pointer',
            padding: 0,
            flexShrink: 0,
            transition: 'background 0.2s',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 3,
              left: enabled ? 23 : 3,
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: 'var(--primary-foreground, #fff)',
              transition: 'left 0.2s',
            }}
          />
        </button>
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--card-foreground)',
          }}
        >
          Auto Top-up
        </span>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: 'var(--muted-foreground)',
          lineHeight: 1.5,
        }}
      >
        You need a valid payment method to enable auto top-up. Try buying some
        credits!
      </p>
    </div>
  );
}

function TaxNote({
  behavior,
}: {
  behavior: 'inclusive' | 'exclusive' | 'location';
}) {
  return (
    <p
      style={{
        marginTop: 14,
        fontSize: 11,
        color: 'var(--muted-foreground)',
        textAlign: 'center',
      }}
    >
      {taxMessages[behavior]}
    </p>
  );
}

export const CreditPackagePicker = React.forwardRef<
  HTMLDivElement,
  CreditPackagePickerProps
>(
  (
    {
      title,
      packages,
      taxBehavior,
      onPurchase,
      isPending,
      error,
      loading,
      showAutoTopUp,
      onAutoTopUpChange,
      className,
      style,
      ...props
    },
    ref,
  ) => {
    const cls = (className ?? '').trim();

    const displayPackages = loading ? loadingPackages : packages;

    if (!loading && packages.length === 0) {
      return (
        <div
          ref={ref}
          className={cls}
          style={{ ...cardBase, ...style }}
          {...props}
        >
          <EmptyMessage message="No top-up packages available." />
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cls}
        style={{
          ...cardBase,
          display: 'flex',
          flexDirection: 'column',
          ...style,
        }}
        {...props}
      >
        <h3
          style={{
            margin: '0 0 20px',
            fontSize: 21,
            fontWeight: 700,
            color: 'var(--card-foreground)',
            lineHeight: 1.2,
          }}
        >
          {title ?? 'Buy Credits'}
        </h3>

        <div style={{ display: 'flex', gap: 10 }}>
          {displayPackages.map(pkg => (
            <PackageTile
              key={pkg.id}
              pkg={pkg}
              disabled={!!loading || !!isPending}
              onSelect={() => onPurchase(pkg.id)}
            />
          ))}
        </div>

        {error && (
          <p
            style={{
              marginTop: 8,
              fontSize: 12,
              color: '#ef4444',
              textAlign: 'center',
            }}
          >
            {error}
          </p>
        )}
        {showAutoTopUp && <AutoTopUpSection onChange={onAutoTopUpChange} />}
        {taxBehavior && <TaxNote behavior={taxBehavior} />}
      </div>
    );
  },
);
CreditPackagePicker.displayName = 'CreditPackagePicker';
