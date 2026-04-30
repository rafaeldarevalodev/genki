
import { genkit } from 'genkit';
import { openAI } from 'genkitx-openai';
import { config } from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
config({ path: envPath });

const baseURL = process.env.OPENAI_BASE_URL || 'http://localhost:1234/v1';
const apiKey = process.env.OPENAI_API_KEY || 'no-key-required';
const activeModel = process.env.LOCAL_MODEL || 'google/gemma-4-26b-a4b';

export const ai = genkit({
  plugins: [
    openAI({
      apiKey,
      baseURL,
    }),
  ],
  model: activeModel,
});

export const getActiveModel = () => activeModel;

export const getTTSModel = () => process.env.TTS_MODEL || 'tts-1';
