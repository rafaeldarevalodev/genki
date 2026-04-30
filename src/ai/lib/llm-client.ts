'use server';

import { config } from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
config({ path: envPath });

const baseURL = process.env.OPENAI_BASE_URL || 'http://localhost:1234/v1';
const apiKey = process.env.OPENAI_API_KEY || 'no-key-required';
const primaryModel = process.env.LOCAL_MODEL || 'mistralai_voxtral-small-24b-2507';
const backupModel = process.env.BACKUP_MODEL || 'google/gemma-4-26b-a4b';

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

function getModelPreference(): string | undefined {
  return undefined;
}

async function callLLM(messages: LLMMessage[], options: LLMOptions = {}) {
  const model = options.model || primaryModel;
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens ?? 2000;

  const allMessages: LLMMessage[] = [];
  
  if (options.systemPrompt) {
    allMessages.push({ role: 'system', content: options.systemPrompt });
  }
  
  allMessages.push(...messages);

  console.log('[callLLM] Using model:', model);

  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
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
  let lastError: Error | null = null;
  
  for (const model of [primaryModel, backupModel]) {
    try {
      console.log(`[callAIWithFallback] Trying model: ${model}`);
      const content = await callLLM(
        [{ role: 'user', content: prompt }],
        { ...options, model }
      );
      console.log(`[callAIWithFallback] Success with: ${model}`);
      return { content, model };
    } catch (error) {
      console.warn(`[callAIWithFallback] Model ${model} failed:`, error.message);
      lastError = error;
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
  let lastError: Error | null = null;
  
  for (const model of [primaryModel, backupModel]) {
    try {
      console.log(`[callAIWithContextFallback] Trying model: ${model}`);
      const content = await callLLM(
        [{ role: 'user', content: userMessage }],
        { ...options, systemPrompt, model }
      );
      console.log(`[callAIWithContextFallback] Success with: ${model}`);
      return { content, model };
    } catch (error) {
      console.warn(`[callAIWithContextFallback] Model ${model} failed:`, error.message);
      lastError = error;
      continue;
    }
  }

  throw new Error(`All models failed. Last error: ${lastError?.message}`);
}