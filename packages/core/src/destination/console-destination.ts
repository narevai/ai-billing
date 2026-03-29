import { createDestination } from './base-destination.js';
import type { Destination } from '../types/index.js';

export function consoleDestination<TTags>(): Destination<TTags> {
  return createDestination<TTags>('console-logger', event => {
    console.dir(event, {
      depth: null,
      colors: true,
      compact: false,
    });
  });
}
