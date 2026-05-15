interface MockStore {
  stripeUsage?: { aggregatedValue: number; found: boolean };
  stripeUsageDelay?: number;
  polarUsage?: {
    consumedUnits: number;
    creditedUnits: number;
    meterName: string;
    found: boolean;
  };
  polarUsageDelay?: number;
  topUpConfig?: {
    packages: CreditPackage[];
    taxBehavior?: 'inclusive' | 'exclusive' | 'location';
  };
  topUpConfigDelay?: number;
}

interface CreditPackage {
  id: string;
  credits: number;
  priceCents: number;
}

declare global {
  var __SB__: MockStore | undefined;
}
