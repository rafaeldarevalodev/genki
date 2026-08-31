'use server';

import { z } from 'genkit';
import { getF5TTSConfig, getKokoroConfig, getTTSConfig } from '@/ai/llm';
import { normalizeTTSProvider } from '@/lib/tts-provider';

// Helper para asegurar puntuación final en texto para TTS
// Sin puntuación, los modelos TTS pueden truncar la última palabra
function ensureEndingPunctuation(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return text;
  // Si no termina en puntuación, agregar punto
  if (!/[.!?]$/.test(trimmed)) {
    return trimmed + '.';
  }
  return trimmed;
}

const TextToSpeechInputSchema = z.object({
  text: z.string(),
  provider: z.unknown().optional(),
  voice: z.string().optional(),
});
export type TextToSpeechInput = z.infer<typeof TextToSpeechInputSchema>;

const TextToSpeechOutputSchema = z.object({
  media: z.string(),
});
export type TextToSpeechOutput = z.infer<typeof TextToSpeechOutputSchema>;

export async function textToSpeech(input: TextToSpeechInput): Promise<TextToSpeechOutput> {
  const rawText = typeof input === 'string' ? input : input.text;
  const text = ensureEndingPunctuation(rawText); // Ensure proper ending for complete audio
  const provider = normalizeTTSProvider(input?.provider ?? getTTSConfig().provider);
  const ttsConfig = provider === 'f5tts' ? getF5TTSConfig() : getKokoroConfig();
  
  console.log('[textToSpeech] Provider:', provider);

  if (provider === 'f5tts') {
    const voice = input?.voice || ttsConfig.voice || 'en-Giuseppe_man';
    return textToSpeechF5TTS(text, voice, ttsConfig.endpoint);
  }
  return textToSpeechKokoro(text, input?.voice || ttsConfig.voice || 'af_bella', ttsConfig.endpoint);
}

async function textToSpeechKokoro(text: string, voice: string, endpoint: string): Promise<TextToSpeechOutput> {
  
  try {
    const response = await fetch(`${endpoint}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: text,
        voice: voice,
        speed: 1.0
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Kokoro TTS failed: ${response.status} - ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);
    const mediaUrl = `data:audio/wav;base64,${base64}`;
    
    return { media: mediaUrl };
  } catch (error) {
    console.error('[textToSpeechKokoro] Error:', error);
    throw error;
  }
}

async function textToSpeechF5TTS(text: string, voice: string, endpoint: string): Promise<TextToSpeechOutput> {
  
  console.log('[F5-TTS] Input text:', text);
  console.log('[F5-TTS] Input voice:', voice);
  
  try {
    const response = await fetch(`${endpoint}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice })
    });

    console.log('[F5-TTS] Response status:', response.status);

    if (!response.ok) {
      throw new Error(`F5-TTS failed: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);
    const mediaUrl = `data:audio/wav;base64,${base64}`;
    
    return { media: mediaUrl };
  } catch (error) {
    console.error('[textToSpeechF5TTS] Error:', error);
    throw error;
  }
}
