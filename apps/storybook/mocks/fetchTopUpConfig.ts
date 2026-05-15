export async function fetchTopUpConfig() {
  const m = globalThis.__SB__;
  if (m?.topUpConfigDelay === -1) return new Promise(() => {});
  if (m?.topUpConfigDelay)
    await new Promise(r => setTimeout(r, m.topUpConfigDelay));
  return m?.topUpConfig ?? { packages: [] };
}
