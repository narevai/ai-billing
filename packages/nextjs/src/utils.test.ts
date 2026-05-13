import { describe, it, expect } from 'vitest';
import { barColor, formatCents, fmt } from './utils.js';

describe('barColor', () => {
  it('returns green for < 70%', () => {
    expect(barColor(0)).toBe('#22c55e');
    expect(barColor(50)).toBe('#22c55e');
    expect(barColor(69)).toBe('#22c55e');
  });

  it('returns amber for 70-89%', () => {
    expect(barColor(70)).toBe('#f59e0b');
    expect(barColor(85)).toBe('#f59e0b');
    expect(barColor(89)).toBe('#f59e0b');
  });

  it('returns red for >= 90%', () => {
    expect(barColor(90)).toBe('#ef4444');
    expect(barColor(100)).toBe('#ef4444');
    expect(barColor(150)).toBe('#ef4444');
  });
});

describe('formatCents', () => {
  it('converts cents to dollars', () => {
    expect(formatCents(1000)).toBe('$10');
    expect(formatCents(1499)).toBe('$15');
    expect(formatCents(1500)).toBe('$15');
    expect(formatCents(0)).toBe('$0');
  });
});

describe('fmt', () => {
  it('formats plain numbers', () => {
    expect(fmt(1000)).toBe('1,000');
    expect(fmt(0)).toBe('0');
  });

  it('formats dollar amounts', () => {
    expect(fmt(10, '$')).toBe('$10');
    expect(fmt(1234.56, '$')).toBe('$1,234.56');
  });

  it('formats with custom unit', () => {
    expect(fmt(500, 'tokens')).toBe('500 tokens');
    expect(fmt(1000, 'calls')).toBe('1,000 calls');
  });
});
