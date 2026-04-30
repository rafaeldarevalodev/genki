import { z } from 'genkit';
import { callAIWithContextFallback } from '@/ai/lib/llm-client';

const ClassifyTextCefrInputSchema = z.object({
  text: z.string().describe('The text to be classified.'),
});
export type ClassifyTextCefrInput = z.infer<typeof ClassifyTextCefrInputSchema>;

const ClassifyTextCefrOutputSchema = z.object({
  cefrLevel: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]).describe('The estimated CEFR level.'),
  justification: z.string().describe('Justification for the classification.'),
});
export type ClassifyTextCefrOutput = z.infer<typeof ClassifyTextCefrOutputSchema>;

const SYSTEM_PROMPT_TEXT = `You are a CEFR language assessment expert. Classify text levels: A1, A2, B1, B2, C1, C2.`;

export async function classifyTextCefr(input: ClassifyTextCefrInput): Promise<ClassifyTextCefrOutput> {
  const prompt = `Classify: "${input.text}"

Return JSON: {"cefrLevel": "A1|A2|B1|B2|C1|C2", "justification": "reason"}`;

  try {
    const result = await callAIWithContextFallback(SYSTEM_PROMPT_TEXT, prompt, {
      temperature: 0.3,
      maxTokens: 200
    });

    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      cefrLevel: parsed.cefrLevel || 'B1',
      justification: parsed.justification || 'Standard English'
    };
  } catch (error) {
    console.error('[classifyTextCefr] Error:', error);
    throw new Error(`AI failed to classify: ${error.message}`);
  }
}