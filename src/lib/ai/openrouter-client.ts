import OpenAI from 'openai';

let openrouterClientInstance: OpenAI | null = null;

function getOpenRouterClient(): OpenAI {
  if (!openrouterClientInstance) {
    openrouterClientInstance = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY!,
      baseURL: 'https://openrouter.ai/api/v1',
    });
  }
  return openrouterClientInstance;
}

export const openrouterClient = getOpenRouterClient();

