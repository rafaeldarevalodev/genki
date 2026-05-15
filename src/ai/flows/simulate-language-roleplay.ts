import { z } from 'genkit';
import { callAIWithContextFallback, type LLMMessage } from '@/ai/llm';

const SimulateLanguageRoleplayInputSchema = z.object({
  vocabulary: z.array(z.string()),
  userMessage: z.string().optional(),
  scenarioContext: z.string().optional(),
  chatHistory: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string() })).optional(),
});
export type SimulateLanguageRoleplayInput = z.infer<typeof SimulateLanguageRoleplayInputSchema>;

const SimulateLanguageRoleplayOutputSchema = z.object({
  aiResponse: z.string(),
});
export type SimulateLanguageRoleplayOutput = z.infer<typeof SimulateLanguageRoleplayOutputSchema>;

const SYSTEM_PROMPT_TEXT = `You are Maya, a friendly English conversation tutor. Keep responses to 2-3 sentences maximum. Be encouraging and natural. After responding, include [tip] with a brief pronunciation or grammar tip. Keep the response text separate from the tip.`;

export async function simulateLanguageRoleplay(
  input: SimulateLanguageRoleplayInput
): Promise<SimulateLanguageRoleplayOutput> {
  const scenario = input.scenarioContext || 'Casual conversation';
  const vocabList = input.vocabulary.join(', ');
  
  const systemContext = `${SYSTEM_PROMPT_TEXT}\n\nScenario: ${scenario}\nVocabulary: ${vocabList}`;

  const historyContext = input.chatHistory && input.chatHistory.length > 0
    ? input.chatHistory.map(m => `${m.role === 'user' ? 'User' : 'You'}: ${m.text}`).join('\n') + '\n'
    : '';

  const prompt = historyContext
    ? `${historyContext}You: ${input.userMessage}`
    : `Start a conversation using: ${vocabList}`;

  try {
    const result = await callAIWithContextFallback(systemContext, prompt, {
      temperature: 0.7,
      maxTokens: 600
    });

    return { aiResponse: result.content };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[simulateLanguageRoleplay] Error:', message);
    throw new Error(`AI failed to generate roleplay response: ${message}`);
  }
}