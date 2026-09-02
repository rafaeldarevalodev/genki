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

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StartRoleplayInput {
  vocabulary: string[];
  scenarioContext: string;
}

export interface ContinueRoleplayInput {
  vocabulary: string[];
  scenarioContext: string;
  chatHistory: { role: 'user' | 'assistant'; text: string }[];
  userMessage: string;
}

export interface EvaluateRoleplayInput {
  userInput: string;
  scenarioContext: string;
  vocabulary?: string[];
}

const ROLEPLAY_SYSTEM_PROMPT = `You are Maya, a friendly English conversation tutor. Keep responses to 2-3 sentences maximum. Be encouraging and natural. After responding, include [tip] with a brief pronunciation or grammar tip. Keep the response text separate from the tip.`;

const EVALUATE_SYSTEM_PROMPT = `You are an English conversation evaluator. Rate 0-100, give detailed feedback, and provide 3 tips.`;

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

  const chat = async (options: {
    messages: ChatMessage[];
    temperature?: number;
    maxTokens?: number;
  }): Promise<string> => {
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
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2000,
        messages: options.messages,
      }),
    });

    if (!response.ok) throw new Error(`The browser model request failed (${response.status}).`);
    const payload = await response.json() as Record<string, unknown>;
    
    // Try multiple response formats (some local models use different structures)
    const choices = payload.choices as Array<{ message?: { content?: string } }> | undefined;
    let result = choices?.[0]?.message?.content;
    
    // Fallback: some models return content directly
    if (!result && typeof payload.content === 'string') {
      result = payload.content;
    }
    // Fallback: some models return text
    if (!result && typeof payload.text === 'string') {
      result = payload.text;
    }
    // Fallback: some models return response
    if (!result && typeof payload.response === 'string') {
      result = payload.response;
    }
    
    if (!result) {
      // Return raw payload as string for debugging
      const debug = JSON.stringify(payload).slice(0, 500);
      console.warn('[model-connection-client] Empty response, raw payload:', debug);
      return `Model returned no content. Raw response: ${debug}`;
    }
    return result;
  };

  return {
    chat,
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

    async startRoleplay(input: StartRoleplayInput): Promise<{ aiResponse: string }> {
      const vocabList = input.vocabulary.join(', ');
      const systemContext = `${ROLEPLAY_SYSTEM_PROMPT}\n\nScenario: ${input.scenarioContext}\nVocabulary: ${vocabList}`;
      const prompt = `Start a conversation using: ${vocabList}`;

      const aiResponse = await chat({
        messages: [
          { role: 'system', content: systemContext },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        maxTokens: 600,
      });

      return { aiResponse };
    },

    async continueRoleplay(input: ContinueRoleplayInput): Promise<{ aiResponse: string }> {
      const vocabList = input.vocabulary.join(', ');
      const systemContext = `${ROLEPLAY_SYSTEM_PROMPT}\n\nScenario: ${input.scenarioContext}\nVocabulary: ${vocabList}`;

      const messages: ChatMessage[] = [
        { role: 'system', content: systemContext },
        ...input.chatHistory.map((m) => ({ role: m.role, content: m.text })),
        { role: 'user', content: input.userMessage },
      ];

      const aiResponse = await chat({
        messages,
        temperature: 0.7,
        maxTokens: 600,
      });

      return { aiResponse };
    },

    async evaluateRoleplay(input: EvaluateRoleplayInput): Promise<{ score: number; feedback: string; tips: string[] }> {
      const vocabList = input.vocabulary?.join(', ') || 'general';
      const prompt = `Evaluate: Scenario="${input.scenarioContext}", Vocab="${vocabList}", Response="${input.userInput}"\n\nReturn JSON: {"score": 0-100, "feedback": "detailed", "tips": ["tip1", "tip2", "tip3"]}`;

      const result = await chat({
        messages: [
          { role: 'system', content: EVALUATE_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.5,
        maxTokens: 800,
      });

      // Resilient JSON extraction
      let jsonString = result;
      const codeBlockMatch = result.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) jsonString = codeBlockMatch[1];
      const jsonMatch = jsonString.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        return { score: 70, feedback: result.slice(0, 500) || 'Good attempt!', tips: ['Keep practicing!'] };
      }

      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          score: typeof parsed.score === 'number' ? parsed.score : 70,
          feedback: parsed.feedback || 'Good attempt!',
          tips: Array.isArray(parsed.tips) ? parsed.tips.slice(0, 3) : ['Keep practicing!'],
        };
      } catch {
        return { score: 70, feedback: result.slice(0, 500) || 'Good attempt!', tips: ['Keep practicing!'] };
      }
    },

    async generateQuizQuestions(input: {
      deckId: string;
      cardFront: string;
      correctAnswer: string;
    }): Promise<{ question: string; distractors: string[] }> {
      const QUIZ_SYSTEM_PROMPT = 'You are a pedagogical quiz designer for English language learning. Create effective multiple-choice questions with plausible distractors.';

      const prompt = `Generate a quiz question for "${input.cardFront}" (answer: "${input.correctAnswer}"). Provide 3 wrong distractors.

Return JSON: {"question": "text", "distractors": ["w1", "w2", "w3"]}`;

      const result = await chat({
        messages: [
          { role: 'system', content: QUIZ_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        maxTokens: 500,
      });

      // Resilient JSON extraction
      let jsonString = result;
      const codeBlockMatch = result.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) jsonString = codeBlockMatch[1];
      const jsonMatch = jsonString.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        return {
          question: `What does "${input.cardFront}" mean?`,
          distractors: [input.correctAnswer],
        };
      }

      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          question: parsed.question || `What does "${input.cardFront}" mean?`,
          distractors: Array.isArray(parsed.distractors) ? parsed.distractors.slice(0, 3) : [],
        };
      } catch {
        return {
          question: `What does "${input.cardFront}" mean?`,
          distractors: [input.correctAnswer],
        };
      }
    },

    async explorePhrase(input: {
      chunk: string;
      userSentence: string;
    }): Promise<{ isCorrect: boolean; feedback: string; annotatedSentence: string }> {
      const EXPLORE_SYSTEM_PROMPT = 'You are Dr. James Morrison, a senior English language tutor. Provide detailed, educational feedback. Be encouraging but precise.';

      const prompt = `Evaluate: chunk="${input.chunk}", sentence="${input.userSentence}"

Return JSON: {"isCorrect": true/false, "feedback": "message", "annotatedSentence": "corrected"}`;

      const result = await chat({
        messages: [
          { role: 'system', content: EXPLORE_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.5,
        maxTokens: 500,
      });

      // Try to extract JSON from response (handles markdown code blocks and plain text)
      let jsonString = result;
      const codeBlockMatch = result.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonString = codeBlockMatch[1];
      }
      const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        // Fallback: return default values instead of crashing
        return {
          isCorrect: true,
          feedback: result.slice(0, 500) || 'Unable to parse model response.',
          annotatedSentence: input.userSentence,
        };
      }

      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          isCorrect: parsed.isCorrect ?? true,
          feedback: parsed.feedback ?? 'Good attempt!',
          annotatedSentence: parsed.annotatedSentence ?? input.userSentence,
        };
      } catch {
        // JSON parse failed — return model text as feedback
        return {
          isCorrect: true,
          feedback: result.slice(0, 500) || 'Unable to parse model response.',
          annotatedSentence: input.userSentence,
        };
      }
    },
  };
}
