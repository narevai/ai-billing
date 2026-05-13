'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { Polar } from '@polar-sh/sdk';

export interface CreditPackage {
  id: string;
  credits: number;
  priceCents: number;
}

export interface CreditTopUpPolarProps {
  narevApiKey: string;
  polarAccessToken: string;
  userId: string;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
}

const NAREV_API = 'https://www.narev.ai/api/billing-target/polar';

const css = {
  fg: 'var(--foreground)',
  bg: 'var(--background)',
  muted: 'var(--muted)',
  mutedFg: 'var(--muted-foreground)',
  card: 'var(--card)',
  cardFg: 'var(--card-foreground)',
  border: 'var(--border)',
  primary: 'var(--primary)',
  primaryFg: 'var(--primary-foreground)',
} as const;

const taxMessages: Record<string, string> = {
  inclusive: 'Prices include tax',
  exclusive: 'Prices do not include tax. Tax will be added at checkout.',
  location: 'Tax calculated at checkout based on your location.',
};

function formatDollars(cents: number): string {
  return `$${Math.round(cents / 100)}`;
}

function LightningIcon({ selected }: { selected: boolean }) {
  return (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: 14,
        background: selected ? css.fg : css.muted,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'background 0.15s',
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M13 2L4.5 13.5H11L10 22L20.5 10.5H14L13 2Z"
          fill={selected ? css.bg : css.mutedFg}
          stroke={selected ? css.bg : css.mutedFg}
          strokeWidth="0.5"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function CreditTopUpPolar({
  narevApiKey,
  polarAccessToken,
  userId,
  title = 'Choose a credit bundle to top up your workspace balance.',
  className,
  style,
}: CreditTopUpPolarProps) {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [taxBehavior, setTaxBehavior] = useState<
    'inclusive' | 'exclusive' | 'location'
  >();
  const [server, setServer] = useState<'sandbox' | 'production'>('sandbox');
  const [loading, setLoading] = useState(true);

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await fetch(NAREV_API, {
          headers: { Authorization: `Bearer ${narevApiKey}` },
        });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;

        const topup: CreditPackage[] = json.data?.topup ?? [];
        const env: 'sandbox' | 'production' =
          json.data?.environment ?? 'sandbox';
        setPackages(topup);
        setServer(env);

        try {
          const polar = new Polar({
            accessToken: polarAccessToken,
            server: env,
          });
          const orgs = await polar.organizations.list({ limit: 1 });
          if (cancelled) return;
          const org = orgs.result?.items?.[0];
          if (
            org?.defaultTaxBehavior === 'inclusive' ||
            org?.defaultTaxBehavior === 'exclusive' ||
            org?.defaultTaxBehavior === 'location'
          ) {
            setTaxBehavior(
              org.defaultTaxBehavior as 'inclusive' | 'exclusive' | 'location',
            );
          }
        } catch {
          // no tax info
        }
      } catch {
        // no config
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [narevApiKey, polarAccessToken]);

  const selected = packages[selectedIdx] ?? null;

  function handlePurchase() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      try {
        const polar = new Polar({ accessToken: polarAccessToken, server });
        const checkout = await polar.checkouts.create({
          products: [selected.id],
          externalCustomerId: userId,
          successUrl: `${window.location.origin}/usage`,
        });
        window.location.href = checkout.url;
      } catch (e) {
        setError(String(e));
      }
    });
  }

  if (loading) {
    return (
      <div
        className={className}
        style={{
          fontFamily: 'inherit',
          width: '100%',
          boxSizing: 'border-box',
          background: css.card,
          color: css.cardFg,
          border: `1px solid ${css.border}`,
          borderRadius: 'var(--radius, 0.75rem)',
          padding: '20px 24px',
          height: 120,
          opacity: 0.5,
          ...style,
        }}
      />
    );
  }

  if (packages.length === 0) {
    return (
      <div
        className={className}
        style={{
          fontFamily: 'inherit',
          width: '100%',
          boxSizing: 'border-box',
          background: css.card,
          color: css.cardFg,
          border: `1px solid ${css.border}`,
          borderRadius: 'var(--radius, 0.75rem)',
          padding: '20px 24px',
          ...style,
        }}
      >
        <p style={{ margin: 0, fontSize: 13, color: css.mutedFg }}>
          No top-up packages available.
        </p>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        fontFamily: 'inherit',
        width: '100%',
        boxSizing: 'border-box',
        background: css.card,
        color: css.cardFg,
        border: `1px solid ${css.border}`,
        borderRadius: 'var(--radius, 0.75rem)',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      {title && (
        <p style={{ margin: '0 0 16px', fontSize: 13, color: css.mutedFg }}>
          {title}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {packages.map((pkg, i) => (
          <PackageRow
            key={i}
            pkg={pkg}
            isSelected={i === selectedIdx}
            onClick={() => setSelectedIdx(i)}
          />
        ))}
      </div>

      {selected && (
        <div
          style={{
            marginTop: 16,
            padding: '12px 0',
            borderTop: `1px solid ${css.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 13,
            color: css.mutedFg,
          }}
        >
          <span>Selected</span>
          <span style={{ fontWeight: 500, color: css.cardFg }}>
            Top-up {formatDollars(selected.priceCents)}
          </span>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <button
          type="button"
          disabled={isPending || !selected}
          onClick={handlePurchase}
          style={{
            fontFamily: 'inherit',
            width: '100%',
            height: 40,
            borderRadius: 'var(--radius, 0.5rem)',
            background: css.primary,
            color: css.primaryFg,
            border: 'none',
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
            <>Top-up {formatDollars(selected.priceCents)}</>
          ) : (
            'Select a package'
          )}
        </button>
        {error && (
          <p
            style={{
              margin: '8px 0 0',
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
            margin: '16px 0 0',
            fontSize: 11,
            color: css.mutedFg,
            textAlign: 'center',
          }}
        >
          {taxMessages[taxBehavior]}
        </p>
      )}
    </div>
  );
}

function PackageRow({
  pkg,
  isSelected,
  onClick,
}: {
  pkg: CreditPackage;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onClick()}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '16px 20px',
        borderRadius: 'var(--radius, 0.75rem)',
        background: isSelected ? css.muted : 'transparent',
        border: `1px solid ${isSelected ? css.border : 'transparent'}`,
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
            fontSize: 15,
            fontWeight: 600,
            color: css.cardFg,
            lineHeight: 1.3,
          }}
        >
          Top-up {formatDollars(pkg.priceCents)}
        </p>
      </div>

      <div style={{ flexShrink: 0 }}>
        <span
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: css.cardFg,
            letterSpacing: '-0.5px',
          }}
        >
          {formatDollars(pkg.priceCents)}
        </span>
      </div>
    </div>
  );
}
