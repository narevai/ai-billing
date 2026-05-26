import { createOpenAI } from '@ai-sdk/openai';
import { customProvider } from 'ai';
import { isTestEnvironment } from '../constants';
import { getBillingWrappedModel } from './billing';
import { titleModel } from './models';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const myProvider = isTestEnvironment
  ? (() => {
      const { chatModel, titleModel } = require('./models.mock');
      return customProvider({
        languageModels: {
          'chat-model': chatModel,
          'title-model': titleModel,
        },
      });
    })()
  : null;

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId);
  }

  return getBillingWrappedModel(openai(modelId));
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel('title-model');
  }
  return openai(titleModel.id);
}
