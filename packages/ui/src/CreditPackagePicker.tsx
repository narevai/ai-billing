import React, { useState } from 'react';
import { cardBase, mutedText } from './styles.js';
import { formatCents, taxMessages } from './utils.js';
import type { CreditPackage } from './types.js';
import { LightningIcon } from './icons.js';

export interface CreditPackagePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  packages: CreditPackage[];
  taxBehavior?: 'inclusive' | 'exclusive' | 'location';
  onPurchase: (packageId: string) => void;
  isPending?: boolean;
  error?: string | null;
  loading?: boolean;
}

export const CreditPackagePicker = React.forwardRef<HTMLDivElement, CreditPackagePickerProps>(
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
    const selected = packages[selectedIdx] ?? null;

    if (loading) {
      const loadingPkgs: CreditPackage[] = [
        { id: '_1', credits: 0, priceCents: 0 },
        { id: '_2', credits: 0, priceCents: 0 },
        { id: '_3', credits: 0, priceCents: 0 },
        { id: '_4', credits: 0, priceCents: 0 },
        { id: '_5', credits: 0, priceCents: 0 },
      ];
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
          {title && <p style={{ ...mutedText, marginBottom: 12 }}>{title}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {loadingPkgs.map((pkg, i) => (
              <div
                key={pkg.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  borderRadius: 'var(--radius, 0.75rem)',
                  opacity: 0.5,
                }}
              >
                <LightningIcon selected={i === 0} />
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
                    Top-up $—
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
                  $—
                </span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20 }}>
            <button
              type="button"
              disabled
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
                cursor: 'not-allowed',
                opacity: 0.6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              Loading…
            </button>
          </div>
        </div>
      );
    }

    if (packages.length === 0) {
      return (
        <div
          ref={ref}
          className={cls}
          style={{ ...cardBase, ...style }}
          {...props}
        >
          <p style={mutedText}>No top-up packages available.</p>
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
        {title && <p style={{ ...mutedText, marginBottom: 12 }}>{title}</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {packages.map((pkg, i) => {
            const isSelected = i === selectedIdx;
            return (
              <div
                key={pkg.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedIdx(i)}
                onKeyDown={(e) =>
                  (e.key === 'Enter' || e.key === ' ') && setSelectedIdx(i)
                }
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  borderRadius: 'var(--radius, 0.75rem)',
                  background: isSelected ? 'var(--muted)' : 'transparent',
                  border: isSelected
                    ? '1px solid var(--border)'
                    : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'background 0.15s, border-color 0.15s',
                  userSelect: 'none',
                  outline: 'none',
                }}
              >
                <LightningIcon selected={isSelected} />
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
                    Top-up {formatCents(pkg.priceCents)}
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
                  {formatCents(pkg.priceCents)}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 20 }}>
          <button
            type="button"
            disabled={isPending || !selected}
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
              cursor: isPending || !selected ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'opacity 0.15s',
            }}
          >
            {isPending ? (
              'Processing…'
            ) : selected ? (
              <>Top-up {formatCents(selected.priceCents)}</>
            ) : (
              'Select a package'
            )}
          </button>
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
        </div>

        {taxBehavior && (
          <p
            style={{
              marginTop: 14,
              fontSize: 11,
              color: 'var(--muted-foreground)',
              textAlign: 'center',
            }}
          >
            {taxMessages[taxBehavior]}
          </p>
        )}
      </div>
    );
  },
);
CreditPackagePicker.displayName = 'CreditPackagePicker';
