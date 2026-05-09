'use server';

import { z } from 'genkit';
import { callAIWithContext } from '@/ai/llm';
import { cleanText } from '@/utils/text-cleaner';

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

const WORDS_SYSTEM_PROMPT = `Role: Vocabulary Extraction Expert for Spanish Speakers.
Goal: Extract each word as a COMPLETE, UNBROKEN unit.

### INPUT TEXT STATUS:
The input has been pre-processed and contains only clean, standard English words.
Do NOT further split or tokenize the words.

### ABSOLUTE RULES:
1. PRESERVE COMPLETE WORDS: Every word must appear as-is, not split into syllables or characters.
   - "interface" → ONE entry, not "inter-face" or "in-ter-a-ce"
   - "AI" → ONE entry, not "A-I"
   - "ever-growing" → ONE entry, keep hyphen
2. ONE WORD PER ENTRY: Each JSON object contains exactly one complete word.
3. SEQUENCE ORDER: Extract words in the order they appear.

### CATEGORIES (assign based on word function):
- "structure": Articles, prepositions (the, and, in, of)
- "action": Verbs (use, have, create, make)
- "concept": Nouns (tools, interface, system, data)
- "modifier": Adjectives/adverbs (simple, very, better)
- "idiom": Contractions/slang (gonna, wanna, kinda)
- "filler": Conversation fillers (like, well, you know)

### OUTPUT FORMAT:
JSON array only. Spanish for "back" and "explanation".

EXAMPLE:
Input: "AI tools have power and interface"
Output:
[
  { "front": "AI", "category": "concept", "back": "Inteligencia Artificial / AI", "ipa": "/ˌeɪˈaɪ/", "spanish_phonetic": "ei-ái", "explanation": "Tecnología que simula inteligencia humana." },
  { "front": "tools", "category": "concept", "back": "herramientas / tools", "ipa": "/tuːlz/", "spanish_phonetic": "tuls", "explanation": "Instrumentos o aplicaciones." },
  { "front": "have", "category": "action", "back": "tienen / have", "ipa": "/hæv/", "spanish_phonetic": "jav", "explanation": "Verbo para indicar posesión." },
  { "front": "power", "category": "concept", "back": "poder / power", "ipa": "/ˈpaʊər/", "spanish_phonetic": "páuer", "explanation": "Capacidad o energía." },
  { "front": "and", "category": "structure", "back": "y / and", "ipa": "/ænd/", "spanish_phonetic": "ánd", "explanation": "Conjunción que conecta elementos." },
  { "front": "interface", "category": "concept", "back": "interfaz / interface", "ipa": "/ˈɪntərfeɪs/", "spanish_phonetic": "intérfeis", "explanation": "Superficie de interacción entre sistemas." }
]`;

export async function generateCardsFromText(input: GenerateCardsFromTextInput): Promise<GenerateCardsFromTextOutput> {
  const mode = input.mode || 'chunks';
  const systemPrompt = mode === 'words' ? WORDS_SYSTEM_PROMPT : CHUNKS_SYSTEM_PROMPT;
  const cleanedText = cleanText(input.text);
  const prompt = cleanedText;

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
    } catch (parseError) {
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
