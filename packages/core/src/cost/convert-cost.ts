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
 * Returns the numeric amount of `cost` expressed in `targetUnit`.
 *
 * Values are converted via an integer nanos intermediate so fractional `base` / `cents` / `micros` amounts
 * round consistently. Throws {@link AiBillingCostError} when `cost.unit` is not a known {@link CostUnit}.
 *
 * @param cost - Source {@link Cost} (amount + unit + currency).
 * @param targetUnit - Unit for the returned number (same scale as {@link Cost} amounts for that unit).
 * @returns The amount in `targetUnit`; for `nanos` this is a whole number of nanos.
 * @internal
 */
export const costToNumber = (cost: Cost, targetUnit: CostUnit): number => {
  const nanos = getNanos(cost);

  if (targetUnit === 'nanos') return nanos;
  if (targetUnit === 'micros') return nanos / 1_000;
  if (targetUnit === 'cents') return nanos / 10_000_000;
  return nanos / 1_000_000_000; // base
};

/**
 * Converts a {@link Cost} to the same amount in a different {@link CostUnit}, preserving `currency`.
 *
 * Implemented with {@link costToNumber}; the result is always a new object.
 *
 * @param cost - Source cost.
 * @param targetUnit - Desired unit for `amount` on the returned object.
 * @returns A new {@link Cost} with `unit: targetUnit` and `amount` in that unit's scale.
 * @internal
 */
export const convertCostUnit = (cost: Cost, targetUnit: CostUnit): Cost => {
  return {
    amount: costToNumber(cost, targetUnit),
    currency: cost.currency,
    unit: targetUnit,
  };
};

/**
 * Wraps a numeric rate as a {@link Cost} in `base` units and `USD` currency.
 *
 * Provider calculators pass per-token prices from {@link ModelPricing} here, then scale with
 * {@link multiplyCost} using token counts.
 *
 * @param amount - Rate amount in base USD units (defaults to `0` when omitted).
 * @returns A {@link Cost} with `unit: 'base'` and `currency: 'USD'`.
 * @internal
 */
export const rateToCost = (amount: number = 0): Cost => ({
  amount,
  unit: 'base',
  currency: 'USD',
});
