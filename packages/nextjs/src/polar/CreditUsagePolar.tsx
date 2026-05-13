'use client';

import React, { useState, useEffect } from 'react';
import { cardBase, heading, mutedText, bigNumber, subLabel, barTrack, barLabels, barColor, fmt } from '../primitives.js';
import { fetchPolarUsage } from './fetchPolarUsage.js';
import type { PolarUsageData } from './types.js';

export interface CreditUsagePolarProps {
  userId: string;
  budget?: number;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function CreditUsagePolar({
  userId, budget, label, className, style,
}: CreditUsagePolarProps) {
  const cn = (className ?? '').trim();
  const [data, setData] = useState<PolarUsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const result = await fetchPolarUsage(userId);
        if (!cancelled) setData(result);
      } catch { if (!cancelled) setData(null); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (loading) {
    return <div className={cn} style={{ ...cardBase, height: 120, opacity: 0.5, ...style }} />;
  }

  if (!data?.found) {
    return (
      <div className={cn} style={{ ...cardBase, ...style }}>
        <p style={mutedText}>No usage data available.</p>
      </div>
    );
  }

  const meterName = label ?? data.meterName;
  const useBudget = budget !== undefined && budget > 0;
  const showBar = useBudget || data.creditedUnits > 0;
  const cap = showBar ? (useBudget ? budget! : data.creditedUnits) : 0;
  const pct = cap > 0 ? Math.min((data.consumedUnits / cap) * 100, 100) : 0;
  const color = barColor(pct);

  return (
    <div className={cn} style={{ ...cardBase, ...style }}>
      <p style={heading}>{meterName}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '0 0 14px' }}>
        <span style={bigNumber}>{fmt(data.consumedUnits, '$')}</span>
        {showBar && <span style={subLabel}>/ {fmt(cap, '$')}</span>}
      </div>
      <div style={barTrack}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: showBar ? color : '#e5e7eb', transition: 'width 0.3s ease' }} />
      </div>
      <div style={barLabels}>
        <span>{showBar ? `${pct.toFixed(0)}% ${useBudget ? 'used' : 'consumed'}` : '0 credits'}</span>
        <span>{showBar ? `${fmt(Math.max(0, cap - data.consumedUnits), '$')} remaining` : `${fmt(data.consumedUnits, '$')} consumed`}</span>
      </div>
    </div>
  );
}
