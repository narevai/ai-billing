import React from 'react';
import { cardBase } from '../styles.js';
import type { ModelPricingItem, NarevPricing } from '@ai-billing/types';

if (typeof document !== 'undefined') {
  if (!document.getElementById('aib-sk')) {
    const s = document.createElement('style');
    s.id = 'aib-sk';
    s.textContent = '@keyframes aib-sk{0%,100%{opacity:.4}50%{opacity:.75}}';
    document.head.appendChild(s);
  }
}

interface PricingField {
  label: string;
  value: number;
}

function formatField(f: PricingField): string {
  if (f.value === 0) return 'Free';
  const perM = f.value * 1_000_000;
  const formatted = perM >= 0.01 ? perM.toFixed(2) : perM.toFixed(4);
  return `$${formatted}/1M`;
}

function isAllFree(p: NarevPricing): boolean {
  return (
    p.prompt === 0 &&
    p.completion === 0 &&
    p.web_search === 0 &&
    p.image === 0 &&
    p.audio === 0 &&
    p.internal_reasoning === 0
  );
}

const pillBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 7px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 500,
  lineHeight: '18px',
  whiteSpace: 'nowrap',
  border: '1px solid transparent',
};

const mono: React.CSSProperties = {
  fontFamily: '"SFMono-Regular","Consolas","Liberation Mono",Menlo,monospace',
  letterSpacing: '-0.01em',
};

function skRect(
  w: string | number,
  h: number,
  borderRadius = 4,
): React.CSSProperties {
  return {
    width: w,
    height: h,
    borderRadius,
    background: 'var(--muted)',
    flexShrink: 0,
    animation: 'aib-sk 1.5s ease-in-out infinite',
  };
}

function SkeletonCard() {
  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div style={skRect('52%', 16)} />
        <div style={{ display: 'flex', gap: 5 }}>
          <div style={skRect(60, 22, 999)} />
          <div style={skRect(44, 22, 999)} />
        </div>
      </div>
      <div
        style={{ height: 1, background: 'var(--border)', marginBottom: 12 }}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px 32px',
        }}
      >
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={skRect('36%', 11)} />
            <div style={skRect('30%', 11)} />
          </div>
        ))}
      </div>
    </>
  );
}

export interface ModelPricingCardProps extends React.HTMLAttributes<HTMLDivElement> {
  model?: ModelPricingItem;
  loading?: boolean;
}

export const ModelPricingCard = React.forwardRef<
  HTMLDivElement,
  ModelPricingCardProps
>(({ model, loading, className, style, ...props }, ref) => {
  const cls = (className ?? '').trim();

  if (loading || !model) {
    return (
      <div
        ref={ref}
        className={cls}
        style={{ ...cardBase, ...style }}
        {...props}
      >
        <SkeletonCard />
      </div>
    );
  }

  const { pricing } = model;
  const isEnterprise = pricing === null;
  const free = !isEnterprise && isAllFree(pricing);
  const hasDiscount = !isEnterprise && (pricing.discount ?? 0) > 0;
  const discountPct = hasDiscount ? Math.round(pricing!.discount * 100) : 0;

  const fields: PricingField[] = isEnterprise
    ? []
    : [
        { label: 'Input', value: pricing!.prompt },
        { label: 'Output', value: pricing!.completion },
        ...(pricing!.input_cache_read > 0
          ? [{ label: 'Cache Read', value: pricing!.input_cache_read }]
          : []),
        ...(pricing!.input_cache_write > 0
          ? [{ label: 'Cache Write', value: pricing!.input_cache_write }]
          : []),
      ];

  return (
    <div ref={ref} className={cls} style={{ ...cardBase, ...style }} {...props}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: isEnterprise ? 0 : 14,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              margin: '0 0 2px',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--card-foreground)',
              ...mono,
              wordBreak: 'break-all',
              lineHeight: 1.4,
            }}
          >
            {model.model_id}
          </p>
          <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
            {model.provider_id}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          {isEnterprise && (
            <span
              style={{
                ...pillBase,
                color: 'var(--muted-foreground)',
                background: 'var(--muted)',
              }}
            >
              Enterprise Only
            </span>
          )}
          {free && (
            <span
              style={{
                ...pillBase,
                color: 'var(--primary-foreground)',
                background: 'var(--primary)',
              }}
            >
              Free
            </span>
          )}
          {hasDiscount && (
            <span
              style={{
                ...pillBase,
                color: 'var(--muted-foreground)',
                background: 'var(--muted)',
              }}
            >
              {discountPct}% off
            </span>
          )}
        </div>
      </div>

      {/* Pricing grid */}
      {!isEnterprise && (
        <>
          <div
            style={{ height: 1, background: 'var(--border)', marginBottom: 12 }}
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '7px 32px',
            }}
          >
            {fields.map(f => (
              <div
                key={f.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--muted-foreground)',
                    fontWeight: 500,
                  }}
                >
                  {f.label}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--card-foreground)',
                    ...mono,
                  }}
                >
                  {formatField(f)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
});
ModelPricingCard.displayName = 'ModelPricingCard';
