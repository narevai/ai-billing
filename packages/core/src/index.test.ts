import { expect, test } from "vitest";
import { initializeBilling, version } from "./index";

test("initializeBilling returns the correct string", () => {
  // version is now automatically "0.0.1" (from your config/package.json)
  const result = initializeBilling({
    apiKey: "sk_test_123",
    provider: "polar",
  });
  
  expect(version).toBe("0.0.1");
  expect(result).toContain(`ai-billing core v${version}`);
});