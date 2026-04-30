'use server';

import { z } from 'genkit';
import { callAIWithContext } from '@/ai/lib/llm-client';

const ExplorePhraseInputSchema = z.object({
  chunk: z.string(),
  userSentence: z.string(),
});
export type ExplorePhraseInput = z.infer<typeof ExplorePhraseInputSchema>;

const ExplorePhraseOutputSchema = z.object({
  isCorrect: z.boolean(),
  feedback: z.string(),
  annotatedSentence: z.string(),
});
export type ExplorePhraseOutput = z.infer<typeof ExplorePhraseOutputSchema>;

const SYSTEM_PROMPT = `You are Dr. James Morrison, a senior English language tutor. Provide detailed, educational feedback. Be encouraging but precise.`;

export async function explorePhrase(input: ExplorePhraseInput): Promise<ExplorePhraseOutput> {
  const prompt = `Evaluate: chunk="${input.chunk}", sentence="${input.userSentence}"

Return JSON: {"isCorrect": true/false, "feedback": "message", "annotatedSentence": "corrected"}`;

  try {
    const content = await callAIWithContext(SYSTEM_PROMPT, prompt, {
      temperature: 0.5,
      maxTokens: 500
    });

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      isCorrect: parsed.isCorrect ?? true,
      feedback: parsed.feedback ?? 'Good attempt!',
      annotatedSentence: parsed.annotatedSentence ?? input.userSentence
    };
  } catch (error) {
    console.error('[explorePhrase] Error:', error);
    throw new Error(`AI failed to evaluate phrase: ${error.message}`);
  }
}