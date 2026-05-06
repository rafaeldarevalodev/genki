import { config, parse } from 'dotenv';
import path from 'path';
import { readFileSync, existsSync } from 'fs';

const envPath = path.resolve(process.cwd(), '.env.local');

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    const parsed = parse(content);
    Object.assign(env, parsed);
  }
  config({ path: envPath });
  return env;
}

// Reload env from file (for getting latest settings)
function reloadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    const parsed = parse(content);
    Object.assign(env, parsed);
  }
  return env;
}

const ENV = loadEnv();

export type LLMProvider = 'local' | 'cloud';
export type TTSProvider = 'piper' | 'voxtral' | 'kokoro';
export type LocalModelName = 'gemma' | 'voxtral';

const LOCAL_MODEL_MAP: Record<LocalModelName, string> = {
  gemma: 'google/gemma-4-4b-it',
  voxtral: 'mistralai_voxtral-small-24b-2507',
};

export interface LLMConfig {
  provider: LLMProvider;
  baseURL: string;
  apiKey: string;
  model: string;
}

export interface TTSConfig {
  provider: TTSProvider;
  endpoint: string;
  voice: string;
  lmstudioVoice?: string;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

function getLLMConfig(): LLMConfig {
  const env = reloadEnv();
  const provider = (env.LLM_PROVIDER || 'local') as LLMProvider;
  const localModelName = (env.LOCAL_MODEL_NAME || 'gemma') as LocalModelName;
  
  if (provider === 'cloud') {
    return {
      provider: 'cloud',
      baseURL: env.CLOUD_BASE_URL || 'https://api.groq.com/openai/v1',
      apiKey: env.CLOUD_API_KEY || env.OPENAI_API_KEY || 'no-key-required',
      model: env.CLOUD_MODEL || 'llama-3.3-70b-versatile',
    };
  }
  
  return {
    provider: 'local',
    baseURL: env.OPENAI_BASE_URL || 'http://localhost:1234/v1',
    apiKey: 'no-key-required',
    model: LOCAL_MODEL_MAP[localModelName],
  };
}

export function getTTSConfig(): TTSConfig {
  // Reload from file to get latest settings
  const env = reloadEnv();
  const provider = (env.TTS_PROVIDER || 'piper') as TTSProvider;
  
  if (provider === 'piper') {
    return {
      provider: 'piper',
      endpoint: env.TTS_ENDPOINT || 'http://localhost:8080',
      voice: env.TTS_VOICE || 'en_GB-alan-medium',
    };
  }
  
  if (provider === 'kokoro') {
    return getKokoroConfig();
  }
  
  return {
    provider: 'voxtral',
    endpoint: 'http://localhost:8000',
    voice: env.TTS_VOICE || 'en_GB-alan-medium',
    lmstudioVoice: env.TTS_VOXTRAL_VOICE || 'en_us_aria',
  };
}

export function getKokoroConfig(): TTSConfig {
  const env = reloadEnv();
  return {
    provider: 'kokoro',
    endpoint: env.TTS_KOKORO_BASE_URL || 'http://localhost:8880',
    voice: env.TTS_KOKORO_VOICE || 'af_bella',
  };
}

export async function getActiveModel(): Promise<string> {
  return getLLMConfig().model;
}

export async function getActiveProvider(): Promise<LLMProvider> {
  return getLLMConfig().provider;
}

async function callLLM(messages: LLMMessage[], options: LLMOptions = {}) {
  const cfg = getLLMConfig();
  const model = options.model || cfg.model;
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens ?? 2000;

  const allMessages: LLMMessage[] = [];

  if (options.systemPrompt) {
    allMessages.push({ role: 'system', content: options.systemPrompt });
  }

  allMessages.push(...messages);

  console.log('[LLM] Using provider:', cfg.provider);
  console.log('[LLM] Using model:', model);
  console.log('[LLM] Using URL:', cfg.baseURL);

  const response = await fetch(`${cfg.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: allMessages,
      temperature: temperature,
      max_tokens: maxTokens
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export async function callAI(prompt: string, options: LLMOptions = {}) {
  return callLLM([{ role: 'user', content: prompt }], options);
}

export async function callAIWithContext(
  systemPrompt: string,
  userMessage: string,
  options: LLMOptions = {}
) {
  return callLLM(
    [{ role: 'user', content: userMessage }],
    { ...options, systemPrompt }
  );
}

export async function callAIWithFallback(
  prompt: string,
  options: LLMOptions = {}
): Promise<{ content: string; model: string }> {
  const cfg = getLLMConfig();
  const models = cfg.provider === 'cloud' 
    ? [cfg.model]
    : [cfg.model];
  
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      console.log(`[LLM] Trying model: ${model}`);
      const content = await callLLM(
        [{ role: 'user', content: prompt }],
        { ...options, model }
      );
      console.log(`[LLM] Success with: ${model}`);
      return { content, model };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[LLM] Model ${model} failed:`, message);
      lastError = error instanceof Error ? error : new Error(message);
      continue;
    }
  }

  throw new Error(`All models failed. Last error: ${lastError?.message}`);
}

export async function callAIWithContextFallback(
  systemPrompt: string,
  userMessage: string,
  options: LLMOptions = {}
): Promise<{ content: string; model: string }> {
  const cfg = getLLMConfig();
  const models = cfg.provider === 'cloud'
    ? [cfg.model]
    : [cfg.model];
    
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      console.log(`[LLM] Trying model: ${model}`);
      const content = await callLLM(
        [{ role: 'user', content: userMessage }],
        { ...options, systemPrompt, model }
      );
      console.log(`[LLM] Success with: ${model}`);
      return { content, model };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[LLM] Model ${model} failed:`, message);
      lastError = error instanceof Error ? error : new Error(message);
      continue;
    }
  }

  throw new Error(`All models failed. Last error: ${lastError?.message}`);
}