import type { UIMessage } from 'ai';
import { z } from 'zod';
import type { getWeather } from './ai/tools/get-weather';
import type { InferUITool } from 'ai';

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

export type ChatTools = {
  getWeather: InferUITool<typeof getWeather>;
};

export type ChatMessage = UIMessage<MessageMetadata, Record<string, never>, ChatTools>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};
