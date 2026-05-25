'use server';

import { z } from 'genkit';
import { getTTSConfig } from '@/ai/llm';

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
  provider: z.enum(['piper', 'kokoro', 'vibevoice7b', 'f5tts']).optional(),
  voice: z.string().optional(),
  referenceAudioData: z.string().optional(),
});
export type TextToSpeechInput = z.infer<typeof TextToSpeechInputSchema>;

const TextToSpeechOutputSchema = z.object({
  media: z.string(),
});
export type TextToSpeechOutput = z.infer<typeof TextToSpeechOutputSchema>;

export async function textToSpeech(input: TextToSpeechInput): Promise<TextToSpeechOutput> {
  const ttsConfig = getTTSConfig();
  const rawText = typeof input === 'string' ? input : input.text;
  const text = ensureEndingPunctuation(rawText); // Ensure proper ending for complete audio
  const provider = input?.provider || ttsConfig.provider;
  
  console.log('[textToSpeech] Provider:', provider);

  if (provider === 'piper') {
    const voice = input?.voice || ttsConfig.voice || 'en_GB-alan-medium';
    return textToSpeechPiper(text, voice);
  }
  
  if (provider === 'kokoro') {
    const voice = input?.voice || ttsConfig.voice || 'af_bella';
    return textToSpeechKokoro(text, voice);
  }

  if (provider === 'vibevoice7b') {
    const voice = input?.voice || ttsConfig.voice || 'en-Emma_woman';
    const referenceAudioData = input?.referenceAudioData;
    return textToSpeechVibeVoice7B(text, voice, referenceAudioData);
  }

  if (provider === 'f5tts') {
    const voice = input?.voice || ttsConfig.voice || 'en-Giuseppe_man';
    return textToSpeechF5TTS(text, voice);
  }
  
  return textToSpeechKokoro(text, ttsConfig.voice || 'af_bella');
}

async function textToSpeechPiper(text: string, voice: string): Promise<TextToSpeechOutput> {
  const ttsConfig = getTTSConfig();
  
  try {
    const response = await fetch(`${ttsConfig.endpoint}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice })
    });

    if (!response.ok) {
      throw new Error(`Piper TTS failed: ${response.status}`);
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
    console.error('[textToSpeechPiper] Error:', error);
    throw error;
  }
}

async function textToSpeechKokoro(text: string, voice: string): Promise<TextToSpeechOutput> {
  const ttsConfig = getTTSConfig();
  
  try {
    const response = await fetch(`${ttsConfig.endpoint}/v1/audio/speech`, {
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

async function textToSpeechVibeVoice7B(text: string, voice: string, referenceAudioData?: string): Promise<TextToSpeechOutput> {
  const ttsConfig = getTTSConfig();

  const requestBody: Record<string, unknown> = {
    input: text,
    voice: voice,
    response_format: 'wav'
  };

  if (referenceAudioData) {
    requestBody.reference_audio_data = referenceAudioData;
  }

  try {
    const response = await fetch(`${ttsConfig.endpoint}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`VibeVoice-7B TTS failed: ${response.status} - ${errorText}`);
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
    console.error('[textToSpeechVibeVoice7B] Error:', error);
    throw error;
  }
}

async function textToSpeechF5TTS(text: string, voice: string): Promise<TextToSpeechOutput> {
  const ttsConfig = getTTSConfig();
  
  console.log('[F5-TTS] Input text:', text);
  console.log('[F5-TTS] Input voice:', voice);
  
  try {
    const response = await fetch(`${ttsConfig.endpoint}/tts`, {
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