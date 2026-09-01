import { describe, it, expect } from 'vitest';

describe('Dev Sandbox Routes', () => {
  it('should have a working OpenAI POST route', async () => {
    const { POST } = await import('../app/api/raw/openai/generate-text/route');
    expect(typeof POST).toBe('function');
  });

  it('should have a working Anthropic POST route', async () => {
    const { POST } = await import('../app/api/raw/anthropic/generate-text/route');
    expect(typeof POST).toBe('function');
  });
});
