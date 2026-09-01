
'use server';

import { generateQuizQuestions } from '@/ai/flows/generate-quiz-questions';
import { simulateLanguageRoleplay } from '@/ai/flows/simulate-language-roleplay';
import { evaluateRoleplayPerformance } from '@/ai/flows/evaluate-roleplay-performance';
import { textToSpeech } from '@/ai/flows/text-to-speech';
import { explorePhrase } from '@/ai/flows/explore-phrase';
import { voicePractice, generateReferenceAudio } from '@/ai/flows/voice-practice';
import { normalizeTTSProvider } from '@/lib/tts-provider';
import type { Card } from '@/lib/types';

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

export async function getTTSAudio(text: string, voice?: string, provider?: unknown): Promise<{media: string} | null> {
  try {
    const validProvider = normalizeTTSProvider(provider);

    console.log('[getTTSAudio] text:', text);
    console.log('[getTTSAudio] voice:', voice);
    console.log('[getTTSAudio] provider:', validProvider);
    
    const input = { text, provider: validProvider, voice };
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
