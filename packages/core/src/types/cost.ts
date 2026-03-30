export type CostUnit = 'base' | 'cents' | 'micros' | 'nanos';

export interface Cost {
  readonly amount: number;
  readonly currency: string;
  readonly unit: CostUnit;
}
