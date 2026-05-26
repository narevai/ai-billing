import { Polar } from '@polar-sh/sdk';

let _polar: Polar | null = null;

function getPolarClient(): Polar | null {
  if (_polar) return _polar;

  const accessToken = process.env.POLAR_ACCESS_TOKEN;
  if (!accessToken) return null;

  const server = (process.env.POLAR_SERVER ?? 'sandbox') as
    | 'sandbox'
    | 'production';

  _polar = new Polar({ accessToken, server });
  return _polar;
}

export async function createPolarCustomer(
  email: string,
  userId: string,
): Promise<void> {
  const polar = getPolarClient();
  if (!polar) return;

  try {
    await polar.customers.create({ email, externalId: userId });
  } catch (error) {
    console.error('[ai-billing] Failed to create Polar customer:', error);
  }
}
