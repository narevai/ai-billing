import {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamResult,
} from '@ai-sdk/provider';
import { notImplemented } from './not-implemented.js';

export class MockLanguageModelV3 implements LanguageModelV3 {
  readonly specificationVersion = 'v3';

  private _supportedUrls: () => LanguageModelV3['supportedUrls'];

  readonly provider: LanguageModelV3['provider'];
  readonly modelId: LanguageModelV3['modelId'];

  doGenerate: LanguageModelV3['doGenerate'];
  doStream: LanguageModelV3['doStream'];

  doGenerateCalls: LanguageModelV3CallOptions[] = [];
  doStreamCalls: LanguageModelV3CallOptions[] = [];

  constructor({
    provider = 'mock-provider',
    modelId = 'mock-model-id',
    supportedUrls = {},
    doGenerate = notImplemented,
    doStream = notImplemented,
  }: {
    provider?: LanguageModelV3['provider'];
    modelId?: LanguageModelV3['modelId'];
    supportedUrls?:
      | LanguageModelV3['supportedUrls']
      | (() => LanguageModelV3['supportedUrls']);
    doGenerate?:
      | LanguageModelV3['doGenerate']
      | LanguageModelV3GenerateResult
      | LanguageModelV3GenerateResult[];
    doStream?:
      | LanguageModelV3['doStream']
      | LanguageModelV3StreamResult
      | LanguageModelV3StreamResult[];
  } = {}) {
    this.provider = provider;
    this.modelId = modelId;
    this.doGenerate = async options => {
      const callIndex = this.doGenerateCalls.length;
      this.doGenerateCalls.push(options);

      if (typeof doGenerate === 'function') {
        return doGenerate(options);
      } else if (Array.isArray(doGenerate)) {
        const result = doGenerate[callIndex];
        if (!result) {
          throw new Error(
            `MockLanguageModelV3: Missing doGenerate mock array result at index ${callIndex}`,
          );
        }
        return result;
      } else {
        return doGenerate;
      }
    };
    this.doStream = async options => {
      const callIndex = this.doStreamCalls.length;
      this.doStreamCalls.push(options);

      if (typeof doStream === 'function') {
        return doStream(options);
      } else if (Array.isArray(doStream)) {
        const result = doStream[callIndex];
        if (!result) {
          throw new Error(
            `MockLanguageModelV3: Missing doStream mock array result at index ${callIndex}`,
          );
        }
        return result;
      } else {
        return doStream;
      }
    };
    this._supportedUrls =
      typeof supportedUrls === 'function'
        ? supportedUrls
        : async () => supportedUrls;
  }

  get supportedUrls() {
    return this._supportedUrls();
  }
}
