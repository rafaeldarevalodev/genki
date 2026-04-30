
'use server';

import { generateCardsFromText } from '@/ai/flows/generate-cards-from-text';
import { generateQuizQuestions } from '@/ai/flows/generate-quiz-questions';
import { simulateLanguageRoleplay } from '@/ai/flows/simulate-language-roleplay';
import { evaluateRoleplayPerformance } from '@/ai/flows/evaluate-roleplay-performance';
import { textToSpeech } from '@/ai/flows/text-to-speech';
import { explorePhrase } from '@/ai/flows/explore-phrase';
import { classifyTextCefr } from '@/ai/flows/classify-text-cefr';
import type { Card, Deck } from '@/lib/types';

/**
 * Nota: En archivos con directiva 'use server', solo se permite la exportación 
 * de funciones asíncronas. Constantes globales no permitidas han sido eliminadas.
 */

export async function generateCardsAction(
  deckName: string,
  text: string,
  images: string[]
): Promise<Deck | { error: string }> {
  try {
    let cefrLevel: string | undefined = undefined;
    if (text.trim()) {
      try {
        const cefrResult = await classifyTextCefr({ text });
        cefrLevel = cefrResult.cefrLevel;
      } catch (cefrError) {
        console.warn('CEFR Classification failed, continuing without it.');
      }
    }

    const result = await generateCardsFromText({ text, images });

    if (!result || !result.cards || result.cards.length === 0) {
      throw new Error('AI failed to generate cards or the result was empty.');
    }

    const enrichedCards: Card[] = result.cards.map((c) => ({
      ...c,
      srs: { interval: 0, repetition: 0, ef: 2.5, nextReview: Date.now(), status: 'new' },
    }));

    const newDeck: Deck = {
      id: Date.now().toString(),
      name: deckName || 'Chunks Deck',
      cards: enrichedCards,
      createdAt: new Date().toLocaleDateString(),
      sourceText: text,
      sourceImages: images,
      cefrLevel: cefrLevel,
    };
    
    return newDeck;

  } catch (err) {
    console.error('ERROR in generateCardsAction:', err);
    return { error: `Failed to generate AI deck: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export async function generateQuizQuestionAction(card: Card) {
  try {
    const correctAnswer = (card.back.split(' / ')[0] || card.back).trim();
    const result = await generateQuizQuestions({
      deckId: 'temp',
      cardFront: card.front,
      correctAnswer: correctAnswer,
    });
    
    const options = [...result.distractors, correctAnswer];
    options.sort(() => Math.random() - 0.5);

    return {
      question: result.question,
      options,
    };
  } catch (error) {
    console.error(error);
    return { error: 'Failed to generate quiz question.' };
  }
}

export async function startRoleplayAction(cards: Card[]) {
    const vocabulary = cards.map(c => c.front);
    const context = `The user wants to practice the following vocabulary in a conversation: ${vocabulary.join(', ')}. Create a simple, friendly scenario where they can use these words and start with the first message.`;
    try {
        const result = await simulateLanguageRoleplay({
            vocabulary,
            scenarioContext: context
        });
        return { scenario: context, first_message: result.aiResponse };
    } catch (error) {
        console.error(error);
        return { error: 'Failed to start roleplay.' };
    }
}

export async function continueRoleplayAction(
    chatHistory: { role: 'user' | 'ai', text: string }[],
    userMessage: string,
    scenarioContext: string,
    vocabulary: string[]
) {
    try {
        const result = await simulateLanguageRoleplay({
            vocabulary,
            scenarioContext,
            chatHistory,
        });
        return { text: result.aiResponse };
    } catch (error) {
        console.error(error);
        return { error: 'Failed to get AI response.' };
    }
}

export async function evaluateRoleplayAction(
  chatHistory: { role: 'user' | 'ai', text: string }[],
  scenarioContext: string
) {
  const userInput = chatHistory.filter(m => m.role === 'user').map(m => m.text).join('\n');
  if (!userInput) return { error: "No user input to evaluate." };

  try {
    const result = await evaluateRoleplayPerformance({
      userInput,
      scenarioContext,
    });
    return result;
  } catch (error) {
    console.error(error);
    return { error: 'Failed to evaluate performance.' };
  }
}

export async function getTTSAudio(text: string, voice?: string, provider?: string, emotion?: string): Promise<{media: string} | null> {
  try {
    const input = typeof text === 'string' 
      ? { text, provider: provider || 'piper', voice: voice, emotion: emotion }
      : text;
    console.log('[getTTSAudio] Calling with:', { provider: input.provider, voice: input.voice, emotion: input.emotion });
    const result = await textToSpeech(input);
    return result;
  } catch (err) {
    console.error('Error fetching TTS audio', err);
    return null;
  }
}

export async function explorePhraseAction(chunk: string, userSentence: string) {
  try {
    const result = await explorePhrase({ chunk, userSentence });
    return result;
  } catch (error) {
    console.error(error);
    return { error: 'Failed to get feedback from AI.' };
  }
}
