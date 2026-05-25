import { customProvider } from 'ai';
import { isTestEnvironment } from '../constants';
import { getChatGateway } from './gateway';
import { titleModel } from './models';

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

export async function getLanguageModel(modelId: string) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId);
  }

  const gw = await getChatGateway();
  if (!gw) throw new Error('Chat gateway not initialized');
  return gw.getModel(`gateway:${modelId}`);
}

export async function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel('title-model');
  }

  const gw = await getChatGateway();
  if (!gw) throw new Error('Chat gateway not initialized');
  return gw.getModel(`gateway:${titleModel.id}`);
}
