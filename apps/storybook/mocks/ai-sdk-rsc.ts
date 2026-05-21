export function createStreamableValue() {
  return { value: null, update: () => {}, done: () => {} };
}

export async function* readStreamableValue(_value: unknown) {
  // no-op in Storybook
}
