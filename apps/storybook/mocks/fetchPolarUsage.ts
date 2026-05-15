export async function fetchPolarUsage(_userId: string) {
  const m = globalThis.__SB__;
  if (m?.polarUsageDelay === -1) return new Promise(() => {});
  if (m?.polarUsageDelay)
    await new Promise(r => setTimeout(r, m.polarUsageDelay));
  return (
    m?.polarUsage ?? {
      consumedUnits: 0,
      creditedUnits: 0,
      meterName: 'Usage',
      found: false,
    }
  );
}
