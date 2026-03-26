export async function consumeStream({
  stream,
  onError,
}: {
  stream: ReadableStream;
  onError?: (error: unknown) => void;
}): Promise<void> {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  } catch (error) {
    onError?.(error);
  } finally {
    reader.releaseLock();
  }
}
