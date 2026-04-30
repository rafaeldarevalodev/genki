import { z } from 'genkit';
import { callAIWithContextFallback } from '@/ai/lib/llm-client';

const EvaluateRoleplayPerformanceInputSchema = z.object({
  userInput: z.string(),
  scenarioContext: z.string(),
  vocabulary: z.array(z.string()).optional(),
});
export type EvaluateRoleplayPerformanceInput = z.infer<typeof EvaluateRoleplayPerformanceInputSchema>;

const EvaluateRoleplayPerformanceOutputSchema = z.object({
  score: z.number(),
  feedback: z.string(),
  tips: z.array(z.string()),
});
export type EvaluateRoleplayPerformanceOutput = z.infer<typeof EvaluateRoleplayPerformanceOutputSchema>;

const SYSTEM_PROMPT_TEXT = `You are an English conversation evaluator. Rate 0-100, give detailed feedback, and provide 3 tips.`;

export async function evaluateRoleplayPerformance(
  input: EvaluateRoleplayPerformanceInput
): Promise<EvaluateRoleplayPerformanceOutput> {
  const vocabList = input.vocabulary?.join(', ') || 'general';
  
  const prompt = `Evaluate: Scenario="${input.scenarioContext}", Vocab="${vocabList}", Response="${input.userInput}"

Return JSON: {"score": 0-100, "feedback": "detailed", "tips": ["tip1", "tip2", "tip3"]}`;

  try {
    const result = await callAIWithContextFallback(SYSTEM_PROMPT_TEXT, prompt, {
      temperature: 0.5,
      maxTokens: 800
    });

    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      score: typeof parsed.score === 'number' ? parsed.score : 70,
      feedback: parsed.feedback || 'Good attempt!',
      tips: Array.isArray(parsed.tips) ? parsed.tips.slice(0, 3) : ['Keep practicing!']
    };
  } catch (error) {
    console.error('[evaluateRoleplayPerformance] Error:', error);
    throw new Error(`AI failed to evaluate: ${error.message}`);
  }
}