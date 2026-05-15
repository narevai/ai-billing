export async function fetchPolarConfig() {
  return (
    globalThis.__SB__?.polarConfig ?? {
      meterId: 'mtr_test',
      environment: 'sandbox' as const,
      topup: [],
    }
  );
}
