import { createDestination } from './base-destination.js';
import type { Destination } from '../types/index.js';

export function consoleDestination<TCustomMeta>(): Destination<TCustomMeta> {
  return createDestination<TCustomMeta>('console-logger', event => {
    console.dir(event, {
      depth: null,
      colors: true,
      compact: false,
    });
  });
}
