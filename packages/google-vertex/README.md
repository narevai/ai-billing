# @ai-billing/google-vertex
Google Vertex AI provider for the AI Billing.

**Installation**
```bash
npm install @ai-billing/core @ai-billing/google-vertex
```

**Usage notes**
Google Vertex AI's Gemini models report reasoning ("thoughts") tokens separately from the visible
completion tokens (`thoughtsTokenCount` in `providerMetadata.vertex.usageMetadata`), and this package
adds them back into the billed completion count, mirroring `@ai-billing/google`'s handling of the same
Gemini-native usage shape.

Vertex also reports `trafficType` (`ON_DEMAND` vs `PROVISIONED`, i.e. committed-throughput calls).
`ModelPricing` has no field for a provisioned-throughput rate, so this package bills every call at the
same resolved rate regardless of `trafficType` — a known, intentional limitation. The raw `trafficType`
value is surfaced on the emitted billing event's `usage.subProvider` field so downstream consumers can
filter or re-rate provisioned traffic themselves.

**Documentation**
For full usage instructions and examples, please refer to the [Documentation](https://www.narev.ai/docs/sdk/ai-billing).
