'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

type BillingCost = {
  amount: number;
  currency: string;
  unit?: string;
};

type BillingCostContextValue = {
  costs: Record<string, BillingCost>;
  setCost: (messageId: string, cost: BillingCost) => void;
};

const BillingCostContext = createContext<BillingCostContextValue | null>(null);

export function BillingCostProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const costsRef = useRef<Record<string, BillingCost>>({});
  const [, setTick] = useState(0);

  const setCost = useCallback((messageId: string, cost: BillingCost) => {
    costsRef.current = { ...costsRef.current, [messageId]: cost };
    setTick(t => t + 1);
  }, []);

  const costs = costsRef.current;

  const value = useMemo(() => ({ costs, setCost }), [costs, setCost]);

  return (
    <BillingCostContext.Provider value={value}>
      {children}
    </BillingCostContext.Provider>
  );
}

export function useBillingCosts() {
  const context = useContext(BillingCostContext);
  if (!context) {
    throw new Error(
      'useBillingCosts must be used within a BillingCostProvider',
    );
  }
  return context;
}
