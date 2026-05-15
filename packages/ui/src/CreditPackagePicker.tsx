import React, { useState } from 'react';
import { cardBase, mutedText } from './styles.js';
import { formatCents, taxMessages } from './utils.js';
import type { CreditPackage } from './types.js';
import { LightningIcon } from './icons.js';
import { EmptyMessage } from './empty.js';

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
}

function packageLabel(pkg: CreditPackage, disabled: boolean) {
  if (disabled) return 'Top-up $—';
  return `Top-up ${formatCents(pkg.priceCents)}`;
}

function packagePrice(pkg: CreditPackage, disabled: boolean) {
  if (disabled) return '$—';
  return formatCents(pkg.priceCents);
}

function PackageRow({
  pkg,
  selected,
  disabled,
  onSelect,
}: {
  pkg: CreditPackage;
  selected: boolean;
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
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        borderRadius: 'var(--radius, 0.75rem)',
        background: selected && !disabled ? 'var(--muted)' : 'transparent',
        border:
          selected && !disabled
            ? '1px solid var(--border)'
            : '1px solid transparent',
        cursor: disabled ? undefined : 'pointer',
        transition: 'background 0.15s, border-color 0.15s',
        userSelect: 'none',
        outline: 'none',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <LightningIcon selected={selected} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--card-foreground)',
            lineHeight: 1.3,
          }}
        >
          {packageLabel(pkg, disabled)}
        </p>
      </div>
      <span
        style={{
          flexShrink: 0,
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--card-foreground)',
        }}
      >
        {packagePrice(pkg, disabled)}
      </span>
    </div>
  );
}

function PurchaseButton({
  packages,
  selectedIdx,
  isPending,
  onPurchase,
  loading,
}: {
  packages: CreditPackage[];
  selectedIdx: number;
  isPending: boolean;
  onPurchase: (id: string) => void;
  loading?: boolean;
}) {
  const selected = packages[selectedIdx] ?? null;
  const isDisabled = loading || isPending || !selected;
  return (
    <div style={{ marginTop: 20 }}>
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => selected && onPurchase(selected.id)}
        style={{
          fontFamily: 'inherit',
          width: '100%',
          height: 38,
          borderRadius: 'var(--radius, 0.5rem)',
          background: 'var(--primary)',
          color: 'var(--primary-foreground)',
          border: 0,
          fontSize: 14,
          fontWeight: 500,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: loading || isPending ? 0.6 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'opacity 0.15s',
        }}
      >
        {loading
          ? 'Loading…'
          : isPending
            ? 'Processing…'
            : selected
              ? `Top-up ${formatCents(selected.priceCents)}`
              : 'Select a package'}
      </button>
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
      title = 'Choose a credit bundle to top up your workspace balance.',
      packages,
      taxBehavior,
      onPurchase,
      isPending,
      error,
      loading,
      className,
      style,
      ...props
    },
    ref,
  ) => {
    const cls = (className ?? '').trim();
    const [selectedIdx, setSelectedIdx] = useState(0);

    const renderContent = () => {
      if (loading) {
        return (
          <>
            {title && <p style={{ ...mutedText, marginBottom: 12 }}>{title}</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {loadingPackages.map((pkg, i) => (
                <PackageRow
                  key={pkg.id}
                  pkg={pkg}
                  selected={i === 0}
                  disabled
                  onSelect={() => {}}
                />
              ))}
            </div>
            <PurchaseButton
              packages={loadingPackages}
              selectedIdx={0}
              isPending={false}
              onPurchase={() => {}}
              loading
            />
          </>
        );
      }

      if (packages.length === 0) {
        return <EmptyMessage message="No top-up packages available." />;
      }

      return (
        <>
          {title && <p style={{ ...mutedText, marginBottom: 12 }}>{title}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {packages.map((pkg, i) => (
              <PackageRow
                key={pkg.id}
                pkg={pkg}
                selected={i === selectedIdx}
                disabled={false}
                onSelect={() => setSelectedIdx(i)}
              />
            ))}
          </div>
          <PurchaseButton
            packages={packages}
            selectedIdx={selectedIdx}
            isPending={!!isPending}
            onPurchase={onPurchase}
          />
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
          {taxBehavior && <TaxNote behavior={taxBehavior} />}
        </>
      );
    };

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
        {renderContent()}
      </div>
    );
  },
);
CreditPackagePicker.displayName = 'CreditPackagePicker';
