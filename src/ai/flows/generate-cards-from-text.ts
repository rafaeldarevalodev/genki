'use server';

import { z } from 'genkit';
import { callAIWithContext } from '@/ai/llm';

const GenerateCardsFromTextInputSchema = z.object({
  text: z.string(),
  images: z.array(z.string()).optional(),
  mode: z.enum(['words', 'chunks']).optional().default('chunks'),
});
export type GenerateCardsFromTextInput = z.infer<typeof GenerateCardsFromTextInputSchema>;

const GenerateCardsFromTextOutputSchema = z.object({
  cards: z.array(z.object({
    front: z.string(),
    back: z.string(),
    ipa: z.string(),
    spanish_phonetic: z.string(),
    explanation: z.string(),
    category: z.enum(['structure', 'action', 'concept', 'modifier', 'idiom', 'filler']),
    voice: z.string().optional(),
  })),
});
export type GenerateCardsFromTextOutput = z.infer<typeof GenerateCardsFromTextOutputSchema>;

const VOXTRAL_VOICES = ['neutral_male', 'casual_female', 'cheerful_female', 'casual_male'];
const PIPER_VOICES = ['en_GB-alan-medium', 'en_US-lessac-medium', 'en_US-ryan-high'];

function getVoiceForCard(): { voice: string } {
  const useVoxtral = Math.random() > 0.5;

  if (useVoxtral) {
    return {
      voice: VOXTRAL_VOICES[Math.floor(Math.random() * VOXTRAL_VOICES.length)],
    };
  } else {
    return {
      voice: PIPER_VOICES[Math.floor(Math.random() * PIPER_VOICES.length)],
    };
  }
}

const VALID_CATEGORIES = ['structure', 'action', 'concept', 'modifier', 'idiom', 'filler'] as const;

function validateCategory(cat: string): typeof VALID_CATEGORIES[number] {
  if (VALID_CATEGORIES.includes(cat as typeof VALID_CATEGORIES[number])) {
    return cat as typeof VALID_CATEGORIES[number];
  }
  return 'concept';
}

const CHUNKS_SYSTEM_PROMPT = `Role: Expert Linguistic Analyst.
Goal: Deconstruct text into the LONGEST possible meaningful lexical chunks. 

### THE "MAXIMUM PHRASING" RULE:
Your priority is to group words into multi-word phrases (2-4 words) that function as a single unit. 
- BAD (Too simple): ["most", "of", "us"] 
- GOOD (Target): ["most of us"]
- BAD (Too simple): ["in", "very", "simple", "ways"]
- GOOD (Target): ["in very simple ways"]

### CRITICAL RULES:
1. WORD INTEGRITY: Never break a word like "interface" into "inter-face".
2. TOTAL COVERAGE: Every word must be included, but prioritize incorporating them into larger chunks first. Standalone words are ONLY allowed for connectors (e.g., "While", "and", "but") that cannot be logically grouped.
3. SEQUENTIAL: Extract in the order they appear.

### CATEGORIES:
- "structure": Connectors/Prepositions (e.g., "While", "In this", "before").
- "action": Verb phrases (e.g., "use them", "can create", "get started").
- "concept": Compound nouns (e.g., "AI tools", "business tasks", "content creation").
- "modifier": Descriptive phrases (e.g., "ever-growing", "much better", "for specific needs").
- "idiom": Fixed expressions (e.g., "one at a time", "diving into").
- "filler": Conversational markers.

### FORMAT: 
JSON array only. "back" and "explanation" in Spanish.

EXAMPLE:
Input: "Most of us use them in very simple ways."
Output:
[
  {
    "front": "Most of us",
    "back": "La mayoría de nosotros",
    "ipa": "/moʊst əv ʌs/",
    "spanish_phonetic": "móust ov as",
    "explanation": "Frase común para referirse a una mayoría.",
    "category": "concept"
  },
  {
    "front": "use them in very simple ways",
    "back": "las usamos de formas muy sencillas",
    "ipa": "/juːz ðəm ɪn ˈvɛri ˈsɪmpəl weɪz/",
    "spanish_phonetic": "iús dem in véri símpol uéis",
    "explanation": "Predicado completo que describe una acción y su modo.",
    "category": "action"
  }
]`;

const WORDS_SYSTEM_PROMPT = `Role: Expert Linguistic Data Processor.
Goal: Tokenize the input text into individual, whole words for a UI Reading View.

### THE ABSOLUTE RULE OF INTEGRITY:
- EVERY WORD must be its own JSON object.
- NEVER split a word into characters or syllables (e.g., "have" is ONE word, NOT "h a ve").
- NEVER break hyphenated words unless they are separated by spaces (e.g., "ever-growing" stays "ever-growing").
- The number of objects in your array must match the number of words in the text.

### PROCESSING STEPS:
1. Split the text strictly by whitespace to identify each word.
2. For each word:
   - "front": The word exactly as it appears (remove attached punctuation like commas or periods).
   - "category": Assign based on function (structure, action, concept, modifier, idiom, filler).
   - "back", "ipa", "spanish_phonetic", "explanation": Standard linguistic analysis in Spanish.

### CATEGORY DEFINITIONS:
- "structure": Articles, prepositions, conjunctions (the, in, and, while).
- "action": Verbs (have, use, create, shows).
- "concept": Nouns (tools, power, interface, analysis).
- "modifier": Adjectives and adverbs (simple, better, often).
- "idiom": Specialized vocabulary or phrasal components.
- "filler": Conversational markers.

### FORMAT: 
Return ONLY a JSON array.

EXAMPLE:
Input: "AI tools have power."
Output:
[
  { "front": "AI", "category": "concept", "back": "IA", "ipa": "/ˌeɪˈaɪ/", "spanish_phonetic": "ei-ái", "explanation": "Inteligencia Artificial." },
  { "front": "tools", "category": "concept", "back": "herramientas", "ipa": "/tuːlz/", "spanish_phonetic": "tuls", "explanation": "Instrumentos." },
  { "front": "have", "category": "action", "back": "tienen", "ipa": "/hæv/", "spanish_phonetic": "jav", "explanation": "Verbo poseer." },
  { "front": "power", "category": "concept", "back": "poder", "ipa": "/ˈpaʊər/", "spanish_phonetic": "páuer", "explanation": "Capacidad." }
]`;

export async function generateCardsFromText(input: GenerateCardsFromTextInput): Promise<GenerateCardsFromTextOutput> {
  const mode = input.mode || 'chunks';
  const systemPrompt = mode === 'words' ? WORDS_SYSTEM_PROMPT : CHUNKS_SYSTEM_PROMPT;

  const prompt = input.text;
  try {
    const result = await callAIWithContext(systemPrompt, prompt, {
      temperature: 0.7,
      maxTokens: 16000
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

    const validatedCards = cards.map((card: any) => {
      const { voice } = getVoiceForCard();
      return {
        front: String(card.front || '').trim(),
        back: String(card.back || '').trim(),
        ipa: String(card.ipa || '').trim(),
        spanish_phonetic: String(card.spanish_phonetic || '').trim(),
        explanation: String(card.explanation || '').trim(),
        category: validateCategory(card.category),
        voice,
      };
    }).filter((card: any) => card.front && card.back);

    if (validatedCards.length === 0) {
      throw new Error('No valid cards generated');
    }

    return { cards: validatedCards };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[generateCardsFromText] Error:', message);
    throw new Error(`AI failed to generate cards: ${message}`);
  }
}