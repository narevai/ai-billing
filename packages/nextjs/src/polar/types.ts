export type { CreditPackage } from '@ai-billing/types';

export interface PolarUsageData {
  consumedUnits: number;
  creditedUnits: number;
  meterName: string;
  found: boolean;
}
