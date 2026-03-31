import { createDestination } from './base-destination.js';
import type { DefaultTags, Destination } from '../types/index.js';
import { JSONObject } from '@ai-sdk/provider';

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
