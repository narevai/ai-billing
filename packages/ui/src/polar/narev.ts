const NAREV_API = 'https://www.narev.ai/api/billing-target/polar';

interface NarevConfig {
  meterId: string;
  environment: 'sandbox' | 'production';
  topup: Array<{ id: string; credits: number; priceCents: number }>;
}

/**
 *
 */
export async function getPolarConfig(
  narevApiKey: string,
): Promise<NarevConfig | null> {
  try {
    const res = await fetch(NAREV_API, {
      headers: { Authorization: `Bearer ${narevApiKey}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data as NarevConfig;
  } catch {
    return null;
  }
}
