import React from 'react';
import { EmptyMessage } from '../empty.js';
import { ModelPricingCard } from './ModelPricingCard.js';
import type { Model } from '@ai-billing/types';

export interface ModelsPricingListProps extends React.HTMLAttributes<HTMLDivElement> {
  models?: Model[];
  loading?: boolean;
  loadingMore?: boolean;
  skeletonCount?: number;
  title?: string;
}

export const ModelsPricingList = React.forwardRef<
  HTMLDivElement,
  ModelsPricingListProps
>(
  (
    {
      models,
      loading,
      loadingMore,
      skeletonCount = 5,
      title,
      className,
      style,
      ...props
    },
    ref,
  ) => {
    const cls = (className ?? '').trim();

    if (!loading && (!models || models.length === 0)) {
      return (
        <div ref={ref} className={cls} style={style} {...props}>
          {title && (
            <p
              style={{
                margin: '0 0 12px',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--foreground)',
              }}
            >
              {title}
            </p>
          )}
          <EmptyMessage message="No models available." />
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cls}
        style={{ display: 'flex', flexDirection: 'column', gap: 12, ...style }}
        {...props}
      >
        {title && (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--foreground)',
            }}
          >
            {title}
          </p>
        )}
        {loading
          ? Array.from({ length: skeletonCount }, (_, i) => (
              <ModelPricingCard key={i} loading />
            ))
          : (models as Model[]).map(model => (
              <ModelPricingCard
                key={`${model.model_id}::${model.provider}`}
                model={model}
              />
            ))}
        {loadingMore && (
          <>
            <ModelPricingCard loading />
            <ModelPricingCard loading />
          </>
        )}
      </div>
    );
  },
);
ModelsPricingList.displayName = 'ModelsPricingList';
