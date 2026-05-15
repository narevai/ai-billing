export type { CreditPackage } from '@ai-billing/ui';

export interface NarevPolarConfig {
  meterId: string;
  environment: 'sandbox' | 'production';
  topup: import('@ai-billing/ui').CreditPackage[];
}

export interface PolarUsageData {
  consumedUnits: number;
  creditedUnits: number;
  meterName: string;
  found: boolean;
}
