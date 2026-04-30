import { z } from 'genkit';
import { callAIWithContextFallback, type LLMMessage } from '@/ai/lib/llm-client';

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

const SYSTEM_PROMPT_TEXT = `You are Dr. Sarah Chen, a senior English conversation tutor. Correct indirectly, use vocabulary naturally, be conversational. After responding, include a brief [tutor note] with feedback.`;

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
    console.error('[simulateLanguageRoleplay] Error:', error);
    throw new Error(`AI failed to generate roleplay response: ${error.message}`);
  }
}