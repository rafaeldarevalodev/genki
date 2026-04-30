import { z } from 'genkit';
import { callAIWithContextFallback } from '@/ai/lib/llm-client';

const QuizGenerationInputSchema = z.object({
  deckId: z.string(),
  cardFront: z.string(),
  correctAnswer: z.string(),
});
export type QuizGenerationInput = z.infer<typeof QuizGenerationInputSchema>;

const QuizGenerationOutputSchema = z.object({
  question: z.string(),
  distractors: z.array(z.string()),
});
export type QuizGenerationOutput = z.infer<typeof QuizGenerationOutputSchema>;

const SYSTEM_PROMPT_TEXT = `You are a pedagogical quiz designer for English language learning. Create effective multiple-choice questions with plausible distractors.`;

export async function generateQuizQuestions(input: QuizGenerationInput): Promise<QuizGenerationOutput> {
  const prompt = `Generate a quiz question for "${input.cardFront}" (answer: "${input.correctAnswer}"). Provide 3 wrong distractors.

Return JSON: {"question": "text", "distractors": ["w1", "w2", "w3"]}`;

  try {
    const result = await callAIWithContextFallback(SYSTEM_PROMPT_TEXT, prompt, {
      temperature: 0.7,
      maxTokens: 500
    });

    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      question: parsed.question || `What does "${input.cardFront}" mean?`,
      distractors: Array.isArray(parsed.distractors) ? parsed.distractors.slice(0, 3) : []
    };
  } catch (error) {
    console.error('[generateQuizQuestions] Error:', error);
    throw new Error(`AI failed to generate questions: ${error.message}`);
  }
}