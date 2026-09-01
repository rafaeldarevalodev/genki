'use client';

import { createModelConnectionsRepository, type ModelConnectionsRepository } from './model-connections-db';
import type { ModelConnection } from './model-connections';
import { cleanText } from '@/utils/text-cleaner';

type CardCategory = 'structure' | 'action' | 'concept' | 'modifier' | 'idiom' | 'filler';

export interface BrowserCard {
  front: string;
  back: string;
  ipa: string;
  spanish_phonetic: string;
  explanation: string;
  category: CardCategory;
  voice: string;
}

export interface GenerateBrowserCardsInput {
  text: string;
  images: string[];
  mode: 'words' | 'chunks';
}

export interface ClassifyBrowserTextInput {
  text: string;
}

export interface BrowserCefrResult {
  cefrLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  justification: string;
}

export class ModelConnectionUnavailableError extends Error {
  constructor() {
    super('No validated active browser model connection is available.');
    this.name = 'ModelConnectionUnavailableError';
  }
}

const validCategories: CardCategory[] = ['structure', 'action', 'concept', 'modifier', 'idiom', 'filler'];
const voices = ['af_bella', 'af_nicole', 'af_sarah', 'af_sky', 'am_adam', 'am_eric', 'am_michael'];

function getActiveValidatedConnection(
  connections: ModelConnection[],
  activeConnectionId?: string,
): ModelConnection {
  const connection = connections.find(({ id }) => id === activeConnectionId);
  if (!connection || connection.lifecycle !== 'validated' || connection.validation?.status !== 'connected') {
    throw new ModelConnectionUnavailableError();
  }
  return connection;
}

function parseJson(content: string): unknown {
  const match = content.match(/\[[\s\S]*\]/) ?? content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('The model returned an invalid JSON response.');
  return JSON.parse(match[0]);
}

function normalizeCards(value: unknown): BrowserCard[] {
  const cards = Array.isArray(value) ? value : [value];
  const normalized = cards.map((card) => {
    const candidate = card as Partial<BrowserCard>;
    return {
      front: String(candidate.front ?? '').trim(),
      back: String(candidate.back ?? '').trim(),
      ipa: String(candidate.ipa ?? '').trim(),
      spanish_phonetic: String(candidate.spanish_phonetic ?? '').trim(),
      explanation: String(candidate.explanation ?? '').trim(),
      category: validCategories.includes(candidate.category as CardCategory) ? candidate.category as CardCategory : 'concept',
      voice: voices[Math.floor(Math.random() * voices.length)],
    };
  }).filter((card) => card.front && card.back);

  if (normalized.length === 0) throw new Error('The model did not generate usable cards.');
  return normalized;
}

function completionUrl(baseUrl: string) {
  return `${baseUrl}/chat/completions`;
}

export function createModelConnectionClient({
  repository = createModelConnectionsRepository(),
  fetchImpl = fetch,
}: {
  repository?: ModelConnectionsRepository;
  fetchImpl?: typeof fetch;
} = {}) {
  const complete = async (system: string, content: unknown) => {
    const restored = await repository.load();
    const connection = getActiveValidatedConnection(restored.connections, restored.activeConnectionId);
    const response = await fetchImpl(completionUrl(connection.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(connection.credential ? { Authorization: `Bearer ${connection.credential}` } : {}),
      },
      body: JSON.stringify({
        model: connection.modelId,
        temperature: 0.7,
        messages: [{ role: 'system', content: system }, { role: 'user', content }],
      }),
    });

    if (!response.ok) throw new Error(`The browser model request failed (${response.status}).`);
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const result = payload.choices?.[0]?.message?.content;
    if (!result) throw new Error('The model returned an empty response.');
    return result;
  };

  return {
    async generateCards(input: GenerateBrowserCardsInput) {
      const content = [
        { type: 'text', text: cleanText(input.text) },
        ...input.images.map((url) => ({ type: 'image_url', image_url: { url } })),
      ];
      const result = await complete(
        `Create ${input.mode === 'words' ? 'individual vocabulary words' : 'meaningful English chunks'} for Spanish learners. Return only a JSON array with front, back, ipa, spanish_phonetic, explanation, and category.`,
        content,
      );
      return { cards: normalizeCards(parseJson(result)) };
    },
    async classifyTextCefr(input: ClassifyBrowserTextInput): Promise<BrowserCefrResult> {
      const result = await complete(
        'Classify the English text using CEFR. Return only JSON with cefrLevel (A1, A2, B1, B2, C1, or C2) and justification.',
        `Classify: "${input.text}"`,
      );
      const parsed = parseJson(result) as Partial<BrowserCefrResult>;
      if (!parsed.cefrLevel || !['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(parsed.cefrLevel)) {
        throw new Error('The model returned an invalid CEFR classification.');
      }
      return { cefrLevel: parsed.cefrLevel, justification: parsed.justification ?? 'No justification provided.' };
    },
  };
}
