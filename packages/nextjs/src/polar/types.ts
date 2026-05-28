import type { CreditPackage } from '@ai-billing/ui';

export type { CreditPackage };

export interface PolarUsageData {
  consumedUnits: number;
  creditedUnits: number;
  meterName: string;
  found: boolean;
}
