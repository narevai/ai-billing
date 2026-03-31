import { describe, it, expect } from 'vitest';
import { costToNumber, convertCostUnit, rateToCost } from './convert-cost.js';
import { AiBillingCostError } from '../index.js';
import type { Cost } from '../types/index.js';

describe('Financial Utils', () => {
  const currency = 'USD';

  describe('costToNumber', () => {
    describe('Happy Path: Standard Conversions', () => {
      it('converts base to cents, micros, and nanos', () => {
        const cost: Cost = { amount: 1.5, currency, unit: 'base' };
        expect(costToNumber(cost, 'base')).toBe(1.5);
        expect(costToNumber(cost, 'cents')).toBe(150);
        expect(costToNumber(cost, 'micros')).toBe(1_500_000);
        expect(costToNumber(cost, 'nanos')).toBe(1_500_000_000);
      });

      it('converts cents to base, micros, and nanos', () => {
        const cost: Cost = { amount: 150, currency, unit: 'cents' };
        expect(costToNumber(cost, 'base')).toBe(1.5);
        expect(costToNumber(cost, 'cents')).toBe(150);
        expect(costToNumber(cost, 'micros')).toBe(1_500_000);
        expect(costToNumber(cost, 'nanos')).toBe(1_500_000_000);
      });

      it('converts micros to base, cents, and nanos', () => {
        const cost: Cost = { amount: 1_500_000, currency, unit: 'micros' };
        expect(costToNumber(cost, 'base')).toBe(1.5);
        expect(costToNumber(cost, 'cents')).toBe(150);
        expect(costToNumber(cost, 'micros')).toBe(1_500_000);
        expect(costToNumber(cost, 'nanos')).toBe(1_500_000_000);
      });

      it('converts nanos to base, cents, and micros', () => {
        const cost: Cost = { amount: 1_500_000_000, currency, unit: 'nanos' };
        expect(costToNumber(cost, 'base')).toBe(1.5);
        expect(costToNumber(cost, 'cents')).toBe(150);
        expect(costToNumber(cost, 'micros')).toBe(1_500_000);
        expect(costToNumber(cost, 'nanos')).toBe(1_500_000_000);
      });
    });

    describe('Edge Cases: High-Precision AI Inference', () => {
      it('safely normalizes fractional microdollars to integer nanos', () => {
        // Your exact real-world scenario
        const cost: Cost = { amount: 0.000004653, currency, unit: 'base' };

        // The safe database integer
        expect(costToNumber(cost, 'nanos')).toBe(4653);

        // Verify it still provides the correct decimal for micros if an API needs it
        expect(costToNumber(cost, 'micros')).toBe(4.653);
      });

      it('safely handles upstream inference costs given directly in nanos', () => {
        const cost: Cost = { amount: 4700, currency, unit: 'nanos' };

        expect(costToNumber(cost, 'base')).toBe(0.0000047);
        expect(costToNumber(cost, 'micros')).toBe(4.7);
      });
    });

    describe('Edge Cases: Floating-Point Safety', () => {
      it('safely handles notorious floating point errors (e.g., 14.99)', () => {
        // 14.99 * 1_000_000_000 in raw JS without rounding is 14989999999.999998
        const cost: Cost = { amount: 14.99, currency, unit: 'base' };

        expect(costToNumber(cost, 'nanos')).toBe(14_990_000_000);
        expect(costToNumber(cost, 'micros')).toBe(14_990_000);
        expect(costToNumber(cost, 'cents')).toBe(1499);
      });

      it('safely handles decimal cents', () => {
        const cost: Cost = { amount: 150.55, currency, unit: 'cents' };
        expect(costToNumber(cost, 'micros')).toBe(1_505_500);
        expect(costToNumber(cost, 'nanos')).toBe(1_505_500_000);
      });
    });

    describe('Edge Cases: Boundaries', () => {
      it('handles zero amounts correctly', () => {
        const cost: Cost = { amount: 0, currency, unit: 'base' };
        expect(costToNumber(cost, 'nanos')).toBe(0);
        expect(costToNumber(cost, 'micros')).toBe(0);
        expect(costToNumber(cost, 'cents')).toBe(0);
      });

      it('handles negative amounts (credits/refunds)', () => {
        const cost: Cost = { amount: -25.5, currency, unit: 'base' };
        expect(costToNumber(cost, 'nanos')).toBe(-25_500_000_000);
        expect(costToNumber(cost, 'micros')).toBe(-25_500_000);
        expect(costToNumber(cost, 'cents')).toBe(-2550);
      });
    });

    describe('Error Handling', () => {
      it('throws AiBillingCostError for unknown units', () => {
        // @ts-expect-error
        const badCost: Cost = { amount: 100, currency, unit: 'invalid_unit' };

        expect(() => costToNumber(badCost, 'base')).toThrowError(
          AiBillingCostError,
        );
        expect(() => costToNumber(badCost, 'base')).toThrowError(
          "Failed to process cost. Unknown CostUnit: 'invalid_unit'.",
        );
      });
    });
  });

  describe('convertCostUnit', () => {
    it('returns a new complete Cost object with the target unit', () => {
      const input: Cost = { amount: 14.99, currency: 'EUR', unit: 'base' };

      const result = convertCostUnit(input, 'micros');

      expect(result).toEqual({
        amount: 14_990_000,
        currency: 'EUR',
        unit: 'micros',
      });
    });

    it('returns a new complete Cost object safely scaled to nanos', () => {
      const input: Cost = { amount: 0.0000047, currency: 'USD', unit: 'base' };

      const result = convertCostUnit(input, 'nanos');

      expect(result).toEqual({
        amount: 4700,
        currency: 'USD',
        unit: 'nanos',
      });
    });

    it('preserves the currency string regardless of conversion', () => {
      const input: Cost = { amount: 500, currency: 'JPY', unit: 'cents' };

      const result = convertCostUnit(input, 'base');

      expect(result.currency).toBe('JPY');
      expect(result.amount).toBe(5);
      expect(result.unit).toBe('base');
    });

    it('does not mutate the original input object', () => {
      const input: Cost = { amount: 10, currency: 'USD', unit: 'base' };

      convertCostUnit(input, 'nanos');

      expect(input).toEqual({ amount: 10, currency: 'USD', unit: 'base' });
    });
  });

  describe('rateToCost', () => {
    it('creates a Cost object with the provided amount', () => {
      const result = rateToCost(15.5);

      expect(result).toEqual({
        amount: 15.5,
        unit: 'base',
        currency: 'USD',
      });
    });

    it('uses the default amount of 0 when no argument is provided', () => {
      // This specifically triggers the coverage for the "= 0" default parameter
      const result = rateToCost();

      expect(result).toEqual({
        amount: 0,
        unit: 'base',
        currency: 'USD',
      });
    });

    it('returns a valid Cost object structure', () => {
      const result = rateToCost(100);

      expect(result).toHaveProperty('amount', 100);
      expect(result).toHaveProperty('unit', 'base');
      expect(result).toHaveProperty('currency', 'USD');
    });
  });
});
