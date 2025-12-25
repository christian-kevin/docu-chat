import OpenAI from 'openai';

const API_TIMEOUT_MS = 10000;

let openrouterClientInstance: OpenAI | null = null;

function getOpenRouterClient(): OpenAI {
  if (!openrouterClientInstance) {
    openrouterClientInstance = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY!,
      baseURL: 'https://openrouter.ai/api/v1',
      timeout: API_TIMEOUT_MS,
    });
  }
  return openrouterClientInstance;
}

export const openrouterClient = getOpenRouterClient();

