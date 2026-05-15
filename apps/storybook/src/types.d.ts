declare module '*.css';

interface MockStore {
  stripeUsage?: { aggregatedValue: number; found: boolean };
  stripeUsageDelay?: number;
  stripeConfig?: { meterId: string } | null;
  polarUsage?: {
    consumedUnits: number;
    creditedUnits: number;
    meterName: string;
    found: boolean;
  };
  polarUsageDelay?: number;
  polarConfig?: {
    meterId: string;
    environment: 'sandbox' | 'production';
    topup: CreditPackage[];
  } | null;
  topUpConfig?: {
    packages: CreditPackage[];
    taxBehavior?: 'inclusive' | 'exclusive' | 'location';
  };
  topUpConfigDelay?: number;
  checkoutUrl?: string;
}

interface CreditPackage {
  id: string;
  credits: number;
  priceCents: number;
}

declare global {
  var __SB__: MockStore | undefined;
}

export {};
