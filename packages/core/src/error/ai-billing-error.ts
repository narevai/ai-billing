const marker = 'ai-billing.error';
const symbol = Symbol.for(marker);

export class AIBillingError extends Error {
  private readonly [symbol] = true;

  readonly cause?: unknown;

  constructor({
    name,
    message,
    cause,
  }: {
    name: string;
    message: string;
    cause?: unknown;
  }) {
    super(message);
    this.name = name;
    this.cause = cause;
  }

  static isInstance(error: unknown): error is AIBillingError {
    return AIBillingError.hasMarker(error, marker);
  }

  protected static hasMarker(error: unknown, markerString: string): boolean {
    const markerSymbol = Symbol.for(markerString);
    return (
      error != null &&
      typeof error === 'object' &&
      markerSymbol in error &&
      typeof error[markerSymbol] === 'boolean' &&
      error[markerSymbol] === true
    );
  }
}
