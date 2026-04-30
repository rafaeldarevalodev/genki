'use server';

import { z } from 'genkit';
import { callAI } from '@/ai/lib/llm-client';

const GenerateCardsFromTextInputSchema = z.object({
  text: z.string(),
  images: z.array(z.string()).optional(),
});
export type GenerateCardsFromTextInput = z.infer<typeof GenerateCardsFromTextInputSchema>;

const GenerateCardsFromTextOutputSchema = z.object({
  cards: z.array(z.object({
    front: z.string(),
    back: z.string(),
    ipa: z.string(),
    spanish_ipa: z.string(),
    explanation: z.string(),
  })),
});
export type GenerateCardsFromTextOutput = z.infer<typeof GenerateCardsFromTextOutputSchema>;

const SYSTEM_PROMPT = `You are a lexical learning specialist. Extract vocabulary chunks from text. For each chunk provide: front (English), back ("spanish / english"), ipa, spanish_ipa, explanation. Extract 30-50 chunks.`;

export async function generateCardsFromText(input: GenerateCardsFromTextInput): Promise<GenerateCardsFromTextOutput> {
  const prompt = `Extract vocabulary from:\n\n${input.text}\n\nReturn JSON array: [{"front": "word", "back": "traducción / word", "ipa": "/pronunciation...", "spanish_ipa": "/pron...", "explanation": "meaning"}]`;

  try {
    const result = await callAI(prompt, {
      temperature: 0.7,
      maxTokens: 64000
    });

    const content = result || '';
    
    let cards;
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/) || content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cards = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(cards)) cards = [cards];
      } else {
        cards = JSON.parse(content);
      }
    } catch {
      throw new Error('Failed to parse AI response as JSON');
    }

    const validatedCards = cards.map((card: any) => ({
      front: String(card.front || '').trim(),
      back: String(card.back || '').trim(),
      ipa: String(card.ipa || '').trim(),
      spanish_ipa: String(card.spanish_ipa || '').trim(),
      explanation: String(card.explanation || '').trim()
    })).filter((card: any) => card.front && card.back);

    if (validatedCards.length === 0) {
      throw new Error('No valid cards generated');
    }

    return { cards: validatedCards };
  } catch (error) {
    console.error('[generateCardsFromText] Error:', error);
    throw new Error(`AI failed to generate cards: ${error.message}`);
  }
}