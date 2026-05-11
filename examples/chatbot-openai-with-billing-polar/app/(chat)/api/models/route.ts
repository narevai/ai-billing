import { getActiveModels, getCapabilities } from '@/lib/ai/models';

export async function GET() {
  const headers = {
    'Cache-Control': 'public, max-age=86400, s-maxage=86400',
  };

  const curatedCapabilities = getCapabilities();

  const models = getActiveModels();
  const capabilities = Object.fromEntries(
    models.map(m => [m.id, curatedCapabilities[m.id]]),
  );

  return Response.json({ capabilities, models }, { headers });
}
