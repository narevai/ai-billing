import { AiBillingCostError } from '../index.js';
import type { Cost, CostUnit } from '../index.js';

const getNanos = (cost: Cost): number => {
  switch (cost.unit) {
    case 'base':
      return Math.round(cost.amount * 1_000_000_000);
    case 'cents':
      return Math.round(cost.amount * 10_000_000);
    case 'micros':
      return Math.round(cost.amount * 1_000);
    case 'nanos':
      return Math.round(cost.amount);
    default:
      throw new AiBillingCostError({
        message: `Failed to process cost. Unknown CostUnit: '${String(cost.unit)}'.`,
      });
  }
};

/**
 * Converts a cost amount to the requested unit.
 * @param cost Cost value and source unit.
 * @param targetUnit Unit to convert the cost into.
 * @returns Cost amount represented in the target unit.
 */
export const costToNumber = (cost: Cost, targetUnit: CostUnit): number => {
  const nanos = getNanos(cost);

  if (targetUnit === 'nanos') return nanos;
  if (targetUnit === 'micros') return nanos / 1_000;
  if (targetUnit === 'cents') return nanos / 10_000_000;
  return nanos / 1_000_000_000; // base
};

/**
 * Converts a cost object to a different unit.
 * @param cost Source cost object.
 * @param targetUnit Unit to convert the cost into.
 * @returns A new cost object with the converted amount and target unit.
 */
export const convertCostUnit = (cost: Cost, targetUnit: CostUnit): Cost => {
  return {
    amount: costToNumber(cost, targetUnit),
    currency: cost.currency,
    unit: targetUnit,
  };
};

/**
 * Creates a base-unit USD cost from a numeric amount.
 * @param amount Numeric cost amount in base units.
 * @returns A cost object in base units.
 */
export const rateToCost = (amount: number = 0): Cost => ({
  amount,
  unit: 'base',
  currency: 'USD',
});
