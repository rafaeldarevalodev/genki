import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/ai/llm', () => ({
  callAIWithContext: vi.fn().mockResolvedValue(JSON.stringify([
    {
      front: 'Hello',
      back: 'Hola',
      ipa: '/həˈloʊ/',
      spanish_phonetic: 'jelóu',
      explanation: 'Saludo',
      category: 'filler',
    },
  ])),
}));

import { generateCardsFromText } from './generate-cards-from-text';

describe('generateCardsFromText voice assignment', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([0, 0.99])('assigns a retained Kokoro voice when random is %s', async (random) => {
    vi.spyOn(Math, 'random').mockReturnValue(random);
    const result = await generateCardsFromText({ text: 'Hello', mode: 'chunks' });
    expect(result.cards[0].voice).toMatch(/^(af_|am_|bm_)/);
    expect(result.cards[0].voice).not.toMatch(/^(en_GB|en_US|es_MX)/);
  });
});
