export interface CreditPackage {
  id: string;
  credits: number;
  priceCents: number;
}

export interface ModelPricing {
  price_prompt: number;
  price_completion: number;
  pricing_discount: number;
  pricing_request: number;
  price_web_search: number;
  price_input_cache_read: number;
  price_input_cache_write: number;
  price_image: number;
  price_image_output: number;
  price_audio: number;
  price_audio_output: number;
  price_input_audio_cache: number;
  price_internal_reasoning: number;
}

export interface Model {
  model_id: string;
  provider: string;
  subprovider: string;
  pricing: ModelPricing | null;
  message?: string;
}

export interface ListModelsMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface ListModelsResponse {
  data: Model[];
  meta: ListModelsMeta;
}
