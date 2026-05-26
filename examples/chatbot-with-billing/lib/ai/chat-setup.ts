import { configureChatTools } from '@ai-billing/nextjs/server';
import { getWeather } from './tools/get-weather';

configureChatTools({ tools: { getWeather }, maxSteps: 5 });
