Vercel AI SDK's methods that actually call the APIs:

```
embed / embedMany: Calls an Embedding Model (converts text to vectors).

rerank: Calls a Reranking Model (re-orders search results based on relevance).

generateImage: Calls an Image Model (e.g., DALL-E 3, Flux).

transcribe: Calls an Audio Model (e.g., Whisper) to turn sound into text.

generateSpeech: Calls a TTS Model (Text-to-Speech) to turn text into audio.

experimental_generateVideo: Calls a Video Model (e.g., Veo, Kling, Luma).

generateText: The fundamental non-streaming call to an LLM.

streamText: The fundamental streaming call to an LLM.

Agent (Interface) / ToolLoopAgent: These are higher-level orchestrators. While they are "Agents," they call generateText or streamText internally to perform their reasoning loops.
```