
'use server';

import { generateCardsFromText } from '@/ai/flows/generate-cards-from-text';
import { cleanText } from '@/utils/text-cleaner';
import { generateQuizQuestions } from '@/ai/flows/generate-quiz-questions';
import { simulateLanguageRoleplay } from '@/ai/flows/simulate-language-roleplay';
import { evaluateRoleplayPerformance } from '@/ai/flows/evaluate-roleplay-performance';
import { textToSpeech } from '@/ai/flows/text-to-speech';
import { explorePhrase } from '@/ai/flows/explore-phrase';
import { classifyTextCefr } from '@/ai/flows/classify-text-cefr';
import { voicePractice, generateReferenceAudio } from '@/ai/flows/voice-practice';
import type { Card, Deck } from '@/lib/types';

export async function generateCardsAction(
  deckName: string,
  text: string,
  images: string[],
  mode: 'words' | 'chunks' = 'chunks'
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

    const result = await generateCardsFromText({ text, images, mode });

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
    chatHistory: { role: 'user' | 'assistant', text: string }[],
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
  chatHistory: { role: 'user' | 'assistant', text: string }[],
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

export async function getTTSAudio(text: string, voice?: string, provider?: string): Promise<{media: string} | null> {
  try {
    const validProvider = (provider === 'piper' || provider === 'kokoro' || provider === 'vibevoice7b' || provider === 'f5tts')
      ? provider as 'piper' | 'kokoro' | 'vibevoice7b' | 'f5tts'
      : 'kokoro';

    let referenceAudioData: string | undefined;
    if (validProvider === 'vibevoice7b' && voice?.startsWith('user_')) {
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('vibevoice7b_user_voices');
          if (stored) {
            const userVoices = JSON.parse(stored);
            const userVoice = userVoices.find((v: {id: string, data: string}) => v.id === voice);
            if (userVoice) {
              referenceAudioData = userVoice.data;
            }
          }
        } catch (e) {
          console.error('Failed to load user voice from localStorage:', e);
        }
      }
    }

    console.log('[getTTSAudio] text:', text);
    console.log('[getTTSAudio] voice:', voice);
    console.log('[getTTSAudio] provider:', validProvider);
    
    const input = { text, provider: validProvider, voice, referenceAudioData };
    console.log('[getTTSAudio] input to textToSpeech:', JSON.stringify(input));
    
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

export async function evaluateVoicePractice(text: string, audioBase64: string, language?: string) {
  try {
    const result = await voicePractice({ text, audio: audioBase64, language: language || 'en' });
    return result;
  } catch (error) {
    console.error('[evaluateVoicePractice]', error);
    return { error: 'Failed to evaluate pronunciation', score: 0 };
  }
}
