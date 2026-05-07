'use server';

import { z } from 'genkit';
import { callAI } from '@/ai/llm';

const GenerateCardsFromTextInputSchema = z.object({
  text: z.string(),
  images: z.array(z.string()).optional(),
});
export type GenerateCardsFromTextInput = z.infer<typeof GenerateCardsFromTextInputSchema>;

const GenerateCardsFromTextOutputSchema = z.object({
  cards: z.array(z.object({
    front: z.string(),
    back: z.string(),
    ipa: z.string(),
    spanish_ipa: z.string(),
    explanation: z.string(),
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

const SYSTEM_PROMPT = `You are an expert Linguistic Analyst and Lexical Learning Specialist. 
Your goal is to deconstruct the provided English text into a COMPLETE list of lexical chunks for Spanish-speaking students.

### INSTRUCTIONS:
1. NO OMISSION: You must process the entire text. Every single word from the original input must be included in at least one chunk. Do not summarize.
2. CHUNK DEFINITION: Extract phrases, collocations, or individual words that carry meaning.
3. PRONUNCIATION RULE (CRITICAL): The field "spanish_phonetic" MUST NOT contain the Spanish translation. It must represent how the English word sounds using Spanish-friendly phonetics.
   - Example: For "People", write "pípol". 
   - Example: For "Tuesday", write "tiús-dei" (DO NOT write "martes").
4. LANGUAGE: The "explanation" and "back" fields must be in Spanish.

### OUTPUT FORMAT:
Return ONLY a JSON array of objects. Do not include conversational text.
Structure:
[
  {
    "front": "English chunk",
    "back": "Traducción al español / Original English",
    "ipa": "Standard IPA transcription",
    "spanish_phonetic": "Approximate English sound using Spanish alphabet",
    "explanation": "Explicación breve del uso o gramática en español"
  }
]

### EXAMPLE:
Input: "Questions about the course?"
Output:
[
  {
    "front": "Questions about",
    "back": "Preguntas sobre / Questions about",
    "ipa": "/ˈkwɛstʃənz əˈbaʊt/",
    "spanish_phonetic": "cuéstions abáut",
    "explanation": "Estructura común para introducir el tema de una duda."
  },
  {
    "front": "the course",
    "back": "el curso / the course",
    "ipa": "/ðə kɔːrs/",
    "spanish_phonetic": "de cors",
    "explanation": "Sustantivo precedido por artículo definido."
  }
]`;


export async function generateCardsFromText(input: GenerateCardsFromTextInput): Promise<GenerateCardsFromTextOutput> {
  const prompt = `Extract vocabulary from:\n\n${input.text}\n\nReturn JSON array: [{"front": "word", "back": "traducción / word", "ipa": "/pronunciation...", "spanish_ipa": "/pron...", "explanation": "meaning"}]`;

  try {
    const result = await callAI(prompt, {
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
        spanish_ipa: String(card.spanish_ipa || '').trim(),
        explanation: String(card.explanation || '').trim(),
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