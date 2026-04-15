import { Cost } from '../types/index.js';
import { AiBillingCostError } from '../index.js';
import { convertCostUnit } from './convert-cost.js';

/**
 * Scales a {@link Cost} by `multiplier` (for example token count × per-token rate).
 *
 * Converts to {@link CostUnit} `nanos`, multiplies the integer nanos amount (rounded), and returns a
 * {@link Cost} with `unit: 'nanos'` and the same `currency` as the input.
 *
 * @param cost - Base cost to scale.
 * @param multiplier - Factor applied to the nanos amount (often a non-negative token count).
 * @returns The scaled cost in nanos.
 * @internal
 */
export const multiplyCost = (cost: Cost, multiplier: number): Cost => {
  const nanosCost = convertCostUnit(cost, 'nanos');
  return {
    ...nanosCost,
    amount: Math.round(nanosCost.amount * multiplier),
  };
};

/**
 * Adds any number of {@link Cost} values after converting each to nanos.
 *
 * All arguments must share the same `currency`; otherwise throws {@link AiBillingCostError}. With no
 * arguments, returns a zero USD cost in nanos. With a single cost, still normalizes to nanos.
 *
 * @param costs - Costs to sum (variadic).
 * @returns The total as a {@link Cost} with `unit: 'nanos'` and the shared `currency`.
 * @internal
 */
export const addCosts = (...costs: Cost[]): Cost => {
  if (costs.length === 0) {
    return { amount: 0, unit: 'nanos', currency: 'USD' };
  }

  const firstCost = costs[0];

  if (!firstCost) {
    return { amount: 0, unit: 'nanos', currency: 'USD' };
  }

  const baseCurrency = firstCost.currency;

  const totalNanos = costs.reduce((sum, currentCost) => {
    if (currentCost.currency !== baseCurrency) {
      throw new AiBillingCostError({
        message: `Currency mismatch: Cannot add ${baseCurrency} to ${currentCost.currency}`,
      });
    }
    return sum + convertCostUnit(currentCost, 'nanos').amount;
  }, 0);

  return { amount: totalNanos, unit: 'nanos', currency: baseCurrency };
};

/**
 * Applies a fractional discount to `cost` in nanos: `amount * (1 - discount)`.
 *
 * If `discount` is falsy or `<= 0`, returns `cost` unchanged (same unit and amount). Otherwise converts to
 * nanos, subtracts `round(amount * discount)`, and clamps the result at zero. Typical `discount` values are
 * between `0` and `1` (for example `0.1` for 10% off).
 *
 * @param cost - Original cost.
 * @param discount - Fraction of the nanos amount to remove (not a percentage label).
 * @returns Either the original `cost` or a discounted {@link Cost} in nanos.
 * @internal
 */
export const applyDiscount = (cost: Cost, discount: number): Cost => {
  if (!discount || discount <= 0) return cost;

  const nanosCost = convertCostUnit(cost, 'nanos');
  const discountAmount = Math.round(nanosCost.amount * discount);

  return {
    ...nanosCost,
    amount: Math.max(0, nanosCost.amount - discountAmount),
  };
};
