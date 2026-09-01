[**@ai-billing/narev**](../README.md)

***

[@ai-billing/narev](/sdk/ai-billing/reference/narev/typedoc/README.md) / NarevClient

# Interface: NarevClient

Defined in: [packages/narev/src/narev-client.ts:27](https://github.com/narevai/ai-billing/blob/main/packages/narev/src/narev-client.ts#L27)

Typed client for the Narev billing API.

Covers model/provider reference,
pricing lookups, and cost calculation.

## Methods

### listModels()

> **listModels**(`request?`): `Promise`\<[`ModelsResponse`](/sdk/ai-billing/reference/narev/typedoc/interfaces/ModelsResponse.md)\>

Defined in: [packages/narev/src/narev-client.ts:29](https://github.com/narevai/ai-billing/blob/main/packages/narev/src/narev-client.ts#L29)

Returns a paginated list of model references (provider_id + model_id, no pricing).

#### Parameters

##### request?

[`ListModelsRequest`](/sdk/ai-billing/reference/narev/typedoc/interfaces/ListModelsRequest.md)

#### Returns

`Promise`\<[`ModelsResponse`](/sdk/ai-billing/reference/narev/typedoc/interfaces/ModelsResponse.md)\>

***

### listProviders()

> **listProviders**(): `Promise`\<[`ProvidersResponse`](/sdk/ai-billing/reference/narev/typedoc/interfaces/ProvidersResponse.md)\>

Defined in: [packages/narev/src/narev-client.ts:32](https://github.com/narevai/ai-billing/blob/main/packages/narev/src/narev-client.ts#L32)

Returns all supported providers with their display name.

#### Returns

`Promise`\<[`ProvidersResponse`](/sdk/ai-billing/reference/narev/typedoc/interfaces/ProvidersResponse.md)\>

***

### listPrices()

> **listPrices**(`request?`): `Promise`\<[`PriceResponse`](/sdk/ai-billing/reference/narev/typedoc/interfaces/PriceResponse.md)\>

Defined in: [packages/narev/src/narev-client.ts:35](https://github.com/narevai/ai-billing/blob/main/packages/narev/src/narev-client.ts#L35)

Returns a paginated list of pricing entries filtered by provider and/or model.

#### Parameters

##### request?

[`ListPricesRequest`](/sdk/ai-billing/reference/narev/typedoc/interfaces/ListPricesRequest.md)

#### Returns

`Promise`\<[`PriceResponse`](/sdk/ai-billing/reference/narev/typedoc/interfaces/PriceResponse.md)\>

***

### searchPrices()

> **searchPrices**(`request?`): `Promise`\<[`PriceResponse`](/sdk/ai-billing/reference/narev/typedoc/interfaces/PriceResponse.md)\>

Defined in: [packages/narev/src/narev-client.ts:38](https://github.com/narevai/ai-billing/blob/main/packages/narev/src/narev-client.ts#L38)

Searches pricing entries by model ID (full-text search via `q`).

#### Parameters

##### request?

[`SearchPricesRequest`](/sdk/ai-billing/reference/narev/typedoc/interfaces/SearchPricesRequest.md)

#### Returns

`Promise`\<[`PriceResponse`](/sdk/ai-billing/reference/narev/typedoc/interfaces/PriceResponse.md)\>

***

### calculateCost()

> **calculateCost**(`request`): `Promise`\<[`TraceCostResponse`](/sdk/ai-billing/reference/narev/typedoc/interfaces/TraceCostResponse.md)\>

Defined in: [packages/narev/src/narev-client.ts:41](https://github.com/narevai/ai-billing/blob/main/packages/narev/src/narev-client.ts#L41)

Calculates the cost for a model call given token usage.

#### Parameters

##### request

[`TraceCostRequest`](/sdk/ai-billing/reference/narev/typedoc/interfaces/TraceCostRequest.md)

#### Returns

`Promise`\<[`TraceCostResponse`](/sdk/ai-billing/reference/narev/typedoc/interfaces/TraceCostResponse.md)\>
