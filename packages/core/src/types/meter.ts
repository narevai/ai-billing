export interface MeterMetadata {
  generation_id: string;
  model_id: string;
  provider: string;
  sub_provider_id?: string;

  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  reasoning_tokens?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  request_count?: number;
  raw_provider_cost?: number;
  raw_upstream_inference_cost?: number;

  [key: string]: string | number | undefined;
}
