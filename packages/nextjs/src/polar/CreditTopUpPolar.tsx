'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { cardBase, mutedText, formatCents, taxMessages } from '../primitives.js';
import { createCheckout as checkoutAction } from './createCheckout.js';
import { fetchTopUpConfig } from './fetchTopUpConfig.js';
import type { CreditPackage } from './types.js';

export interface CreditTopUpPolarProps {
  userId: string;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
}

function LightningIcon({ selected }: { selected: boolean }) {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s',
      background: selected ? 'var(--foreground)' : 'var(--muted)',
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M13 2L4.5 13.5H11L10 22L20.5 10.5H14L13 2Z"
          fill={selected ? 'var(--background)' : 'var(--muted-foreground)'}
          stroke={selected ? 'var(--background)' : 'var(--muted-foreground)'}
          strokeWidth="0.5" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function CreditTopUpPolar({
  userId, title = 'Choose a credit bundle to top up your workspace balance.',
  className, style,
}: CreditTopUpPolarProps) {
  const cn = (className ?? '').trim();
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [taxBehavior, setTaxBehavior] = useState<'inclusive' | 'exclusive' | 'location'>();
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const config = await fetchTopUpConfig();
        if (cancelled) return;
        setPackages(config.packages);
        if (config.taxBehavior) setTaxBehavior(config.taxBehavior);
      } catch { /* no data */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const selected = packages[selectedIdx] ?? null;

  function handlePurchase() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      try {
        const url = await checkoutAction(selected.id, userId, window.location.origin);
        window.location.href = url;
      } catch (e) { setError(String(e)); }
    });
  }

  if (loading) {
    return <div className={cn} style={{ ...cardBase, height: 120, opacity: 0.5, ...style }} />;
  }

  if (packages.length === 0) {
    return (
      <div className={cn} style={{ ...cardBase, ...style }}>
        <p style={mutedText}>No top-up packages available.</p>
      </div>
    );
  }

  return (
    <div className={cn} style={{ ...cardBase, display: 'flex', flexDirection: 'column', ...style }}>
      {title && <p style={{ ...mutedText, marginBottom: 12 }}>{title}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {packages.map((pkg, i) => {
          const isSelected = i === selectedIdx;
          return (
            <div key={pkg.id} role="button" tabIndex={0}
              onClick={() => setSelectedIdx(i)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelectedIdx(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                borderRadius: 'var(--radius, 0.75rem)',
                background: isSelected ? 'var(--muted)' : 'transparent',
                border: isSelected ? '1px solid var(--border)' : '1px solid transparent',
                cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s',
                userSelect: 'none', outline: 'none',
              }}
            >
              <LightningIcon selected={isSelected} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--card-foreground)', lineHeight: 1.3 }}>
                  Top-up {formatCents(pkg.priceCents)}
                </p>
              </div>
              <span style={{ flexShrink: 0, fontSize: 16, fontWeight: 700, color: 'var(--card-foreground)' }}>
                {formatCents(pkg.priceCents)}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 20 }}>
        <button type="button" disabled={isPending || !selected} onClick={handlePurchase}
          style={{
            fontFamily: 'inherit', width: '100%', height: 38,
            borderRadius: 'var(--radius, 0.5rem)', background: 'var(--primary)', color: 'var(--primary-foreground)',
            border: 0, fontSize: 14, fontWeight: 500, cursor: isPending || !selected ? 'not-allowed' : 'pointer',
            opacity: isPending ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'opacity 0.15s',
          }}
        >
          {isPending ? 'Processing…' : selected ? <>Top-up {formatCents(selected.priceCents)}</> : 'Select a package'}
        </button>
        {error && <p style={{ marginTop: 8, fontSize: 12, color: '#ef4444', textAlign: 'center' }}>{error}</p>}
      </div>

      {taxBehavior && (
        <p style={{ marginTop: 14, fontSize: 11, color: 'var(--muted-foreground)', textAlign: 'center' }}>
          {taxMessages[taxBehavior]}
        </p>
      )}
    </div>
  );
}
