import { Cost } from '../types/index.js';
import { AiBillingCostError } from '../index.js';
import { convertCostUnit } from './convert-cost.js';

/**
 * Multiplies a cost amount by a numeric multiplier.
 *
 * @param cost - The base cost to scale.
 * @param multiplier - The number used to scale the cost amount.
 * @returns The scaled cost in nanos.
 */
export const multiplyCost = (cost: Cost, multiplier: number): Cost => {
  const nanosCost = convertCostUnit(cost, 'nanos');
  return {
    ...nanosCost,
    amount: Math.round(nanosCost.amount * multiplier),
  };
};

/**
 * Sums multiple costs into a single nanos-based cost.
 *
 * @param costs - Costs to add together.
 * @returns The total cost in nanos.
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
 * Applies a percentage discount to a cost.
 *
 * @param cost - The original cost.
 * @param discount - Discount ratio between 0 and 1.
 * @returns The discounted cost in nanos.
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
