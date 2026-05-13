export interface CreditPackage {
  id: string;
  credits: number;
  priceCents: number;
}

export interface NarevPolarConfig {
  meterId: string;
  environment: 'sandbox' | 'production';
  topup: CreditPackage[];
}

export interface PolarUsageData {
  consumedUnits: number;
  creditedUnits: number;
  meterName: string;
  found: boolean;
}
