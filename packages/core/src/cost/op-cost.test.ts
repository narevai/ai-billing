import { describe, it, expect, vi } from 'vitest';
import { multiplyCost, addCosts, applyDiscount } from './op-cost.js';
import { Cost, CostUnit } from '../types/cost.js';

// Mock the convertCostUnit dependency to focus purely on the math logic in op-cost
vi.mock('./convert-cost.js', () => ({
  convertCostUnit: vi.fn((cost, targetUnit) => {
    // If it's already the target unit, pass it through
    if (cost.unit === targetUnit) return cost;
    // Simple mock conversion: USD to nanos for testing
    if (cost.unit === 'USD' && targetUnit === 'nanos') {
      return { ...cost, amount: cost.amount * 1_000_000_000, unit: 'nanos' };
    }
    return { ...cost, unit: targetUnit };
  }),
}));

describe('op-cost module', () => {
  describe('multiplyCost', () => {
    it('should multiply a nanos cost by an integer multiplier', () => {
      const baseCost = {
        amount: 100,
        unit: 'nanos' as CostUnit,
        currency: 'USD',
      };
      const result = multiplyCost(baseCost, 5);
      expect(result).toEqual({ amount: 500, unit: 'nanos', currency: 'USD' });
    });

    it('should handle fractional multipliers and round the result', () => {
      const baseCost = {
        amount: 100,
        unit: 'nanos' as CostUnit,
        currency: 'USD',
      };
      const result = multiplyCost(baseCost, 2.5);
      expect(result).toEqual({ amount: 250, unit: 'nanos', currency: 'USD' });
    });

    it('should handle zero multipliers', () => {
      const baseCost = {
        amount: 100,
        unit: 'nanos' as CostUnit,
        currency: 'USD',
      };
      const result = multiplyCost(baseCost, 0);
      expect(result).toEqual({ amount: 0, unit: 'nanos', currency: 'USD' });
    });

    it('should convert unit to nanos before multiplying', () => {
      const baseCost = { amount: 1, unit: 'USD' as CostUnit, currency: 'USD' }; // $1
      const result = multiplyCost(baseCost, 2);
      expect(result).toEqual({
        amount: 2_000_000_000,
        unit: 'nanos',
        currency: 'USD',
      });
    });
  });

  describe('addCosts', () => {
    it('should return 0 nanos when provided an empty array', () => {
      const result = addCosts();
      expect(result).toEqual({
        amount: 0,
        unit: 'nanos' as CostUnit,
        currency: 'USD',
      });
    });

    it('should return the identical cost if only one is provided', () => {
      const cost = { amount: 500, unit: 'nanos' as CostUnit, currency: 'USD' };
      const result = addCosts(cost);
      expect(result).toEqual({ amount: 500, unit: 'nanos', currency: 'USD' });
    });

    it('should add multiple costs of the same currency correctly', () => {
      const cost1 = { amount: 100, unit: 'nanos' as CostUnit, currency: 'USD' };
      const cost2 = { amount: 200, unit: 'nanos' as CostUnit, currency: 'USD' };
      const result = addCosts(cost1, cost2);
      expect(result).toEqual({
        amount: 300,
        unit: 'nanos' as CostUnit,
        currency: 'USD',
      });
    });

    it('should convert mixed units to nanos before adding', () => {
      const cost1 = { amount: 100, unit: 'nanos' as CostUnit, currency: 'USD' };
      const cost2 = { amount: 1, unit: 'USD' as CostUnit, currency: 'USD' }; // 1 billion nanos
      const result = addCosts(cost1, cost2);
      expect(result).toEqual({
        amount: 1_000_000_100,
        unit: 'nanos',
        currency: 'USD',
      });
    });

    it('should throw an error on currency mismatch', () => {
      const cost1 = { amount: 100, unit: 'nanos' as CostUnit, currency: 'USD' };
      const cost2 = { amount: 100, unit: 'nanos' as CostUnit, currency: 'EUR' };
      expect(() => addCosts(cost1, cost2)).toThrow(/Currency mismatch/);
    });

    it('should return 0 nanos when the first cost is undefined or null', () => {
      const result = addCosts(undefined as unknown as Cost);

      expect(result).toEqual({
        amount: 0,
        unit: 'nanos' as CostUnit,
        currency: 'USD',
      });
    });
  });

  describe('applyDiscount', () => {
    it('should return the original cost if discount is 0', () => {
      const cost = { amount: 1000, unit: 'nanos' as CostUnit, currency: 'USD' };
      const result = applyDiscount(cost, 0);
      expect(result).toEqual({
        amount: 1000,
        unit: 'nanos' as CostUnit,
        currency: 'USD',
      });
    });

    it('should return the original cost if discount is negative', () => {
      const cost = { amount: 1000, unit: 'nanos' as CostUnit, currency: 'USD' };
      const result = applyDiscount(cost, -0.5); // Guardrail check
      expect(result).toEqual({
        amount: 1000,
        unit: 'nanos' as CostUnit,
        currency: 'USD',
      });
    });

    it('should correctly apply a percentage discount', () => {
      const cost = { amount: 1000, unit: 'nanos' as CostUnit, currency: 'USD' };
      const result = applyDiscount(cost, 0.2); // 20% discount
      expect(result).toEqual({
        amount: 800,
        unit: 'nanos' as CostUnit,
        currency: 'USD',
      });
    });

    it('should round the discounted amount properly', () => {
      const cost = { amount: 100, unit: 'nanos' as CostUnit, currency: 'USD' };
      const result = applyDiscount(cost, 0.333); // 33.3 nanos -> rounded to 33. Final: 67
      expect(result).toEqual({
        amount: 67,
        unit: 'nanos' as CostUnit,
        currency: 'USD',
      });
    });

    it('should bottom out at 0 for >=100% discounts', () => {
      const cost = { amount: 1000, unit: 'nanos' as CostUnit, currency: 'USD' };
      const result = applyDiscount(cost, 1.5);
      expect(result).toEqual({
        amount: 0,
        unit: 'nanos' as CostUnit,
        currency: 'USD',
      });
    });
  });
});
