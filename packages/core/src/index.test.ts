import { expect, test } from 'vitest';
import { ConsoleDestination } from './index.js';

test('ConsoleDestination initializes and binds the handle method', () => {
  const logger = new ConsoleDestination({ prefix: '[test-prefix]' });
  expect(logger).toBeDefined();
  expect(typeof logger.handle).toBe('function');
});
