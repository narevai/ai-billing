'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ModelsPricingList, ModelSearchBox } from '@ai-billing/ui';
import type { Model } from '@ai-billing/ui';
import { fetchModelsPricing } from './fetchModelsPricing.js';

export interface ModelsPricingProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional heading rendered above the list. */
  title?: string;
  /** Full-text search across model IDs. */
  search?: string;
  /** Render a search box above the list; its value overrides the search prop. */
  searchBoxVisible?: boolean;
  /** Include models with enterprise-only pricing (pricing: null). Defaults to true. */
  showEnterpriseOnly?: boolean;
  /** Number of results per page (defaults to 100). */
  limit?: number;
  /** Number of skeleton cards shown during initial load (defaults to 5). */
  skeletonCount?: number;
}

type FetchParams = {
  search?: string;
  limit?: number;
  page: number;
};

export const ModelsPricing = React.forwardRef<
  HTMLDivElement,
  ModelsPricingProps
>(
  (
    {
      title,
      search: searchProp,
      searchBoxVisible,
      showEnterpriseOnly = true,
      limit,
      skeletonCount,
      className,
      style,
      ...props
    },
    ref,
  ) => {
    const [searchInput, setSearchInput] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [fetchParams, setFetchParams] = useState<FetchParams>({
      search: searchProp,
      limit,
      page: 1,
    });
    const [models, setModels] = useState<Model[]>([]);
    const [totalPages, setTotalPages] = useState(1);
    const [initialLoading, setInitialLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const sentinelRef = useRef<HTMLDivElement>(null);

    // Debounce the search box input
    useEffect(() => {
      if (!searchBoxVisible) return;
      const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
      return () => clearTimeout(timer);
    }, [searchInput, searchBoxVisible]);

    // Resolve effective search: box value takes priority when visible
    const effectiveSearch = searchBoxVisible
      ? debouncedSearch || undefined
      : searchProp;

    // Reset when filters change
    useEffect(() => {
      setFetchParams({ search: effectiveSearch, limit, page: 1 });
      setModels([]);
      setInitialLoading(true);
    }, [effectiveSearch, limit]);

    // Fetch whenever fetchParams changes
    useEffect(() => {
      let cancelled = false;
      const isFirst = fetchParams.page === 1;

      if (!isFirst) setLoadingMore(true);

      (async () => {
        try {
          const result = await fetchModelsPricing(fetchParams);
          if (cancelled) return;
          setModels(prev =>
            isFirst ? result.models : [...prev, ...result.models],
          );
          setTotalPages(result.meta.total_pages);
        } catch {
          /* silent — fetchModelsPricing already logs */
        } finally {
          if (!cancelled) {
            setInitialLoading(false);
            setLoadingMore(false);
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [fetchParams]);

    // Observe sentinel to trigger next page
    const hasMore = fetchParams.page < totalPages;

    useEffect(() => {
      const sentinel = sentinelRef.current;
      if (!sentinel || !hasMore || loadingMore || initialLoading) return;

      const observer = new IntersectionObserver(
        entries => {
          if (entries[0]?.isIntersecting) {
            setFetchParams(prev => ({ ...prev, page: prev.page + 1 }));
          }
        },
        { threshold: 0.1 },
      );

      observer.observe(sentinel);
      return () => observer.disconnect();
    }, [hasMore, loadingMore, initialLoading]);

    const visibleModels = showEnterpriseOnly
      ? models
      : models.filter(m => m.pricing !== null);

    return (
      <div
        ref={ref}
        className={className ?? ''}
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          ...style,
        }}
        {...props}
      >
        {searchBoxVisible && (
          <div style={{ flexShrink: 0, paddingBottom: 12 }}>
            <ModelSearchBox value={searchInput} onChange={setSearchInput} />
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <ModelsPricingList
            title={title}
            models={visibleModels}
            loading={initialLoading}
            loadingMore={loadingMore}
            skeletonCount={skeletonCount}
          />
          <div ref={sentinelRef} style={{ height: 1 }} />
        </div>
      </div>
    );
  },
);
ModelsPricing.displayName = 'ModelsPricing';
