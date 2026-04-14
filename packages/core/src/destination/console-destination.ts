import { createDestination } from './base-destination.js';
import type { DefaultTags, Destination } from '../types/index.js';

/**
 * Creates a destination that logs billing events to the console.
 *
 * @returns A destination that prints each event with full depth formatting.
 */
export function consoleDestination<
  TTags extends DefaultTags = DefaultTags,
>(): Destination<TTags> {
  return createDestination<TTags>('console-logger', event => {
    console.dir(event, {
      depth: null,
      colors: true,
      compact: false,
    });
  });
}
