[**@ai-billing/narev**](../README.md)

***

[@ai-billing/narev](/sdk/ai-billing/reference/narev/typedoc/README.md) / SearchPricesRequest

# Interface: SearchPricesRequest

Defined in: packages/types/dist/index.d.ts:173

Options for searching pricing by model ID (GET /v1/prices/search).

## Properties

### q?

> `optional` **q?**: `string`

Defined in: packages/types/dist/index.d.ts:175

Full-text search query matched against model ID.

***

### provider\_id?

> `optional` **provider\_id?**: `string`

Defined in: packages/types/dist/index.d.ts:176

***

### model\_id?

> `optional` **model\_id?**: `string`

Defined in: packages/types/dist/index.d.ts:177

***

### sort\_by?

> `optional` **sort\_by?**: `"provider_id"` \| `"model_id"`

Defined in: packages/types/dist/index.d.ts:178

***

### order?

> `optional` **order?**: `"asc"` \| `"desc"`

Defined in: packages/types/dist/index.d.ts:179

***

### page?

> `optional` **page?**: `number`

Defined in: packages/types/dist/index.d.ts:180

***

### page\_size?

> `optional` **page\_size?**: `number`

Defined in: packages/types/dist/index.d.ts:181
