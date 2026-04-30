'use server';

import { z } from 'genkit';
import { config } from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
config({ path: envPath });

const TextToSpeechInputSchema = z.object({
  text: z.string(),
  provider: z.enum(['piper', 'voxtral_tts']).optional(),
  voice: z.string().optional(),
  emotion: z.string().optional(),
});
export type TextToSpeechInput = z.infer<typeof TextToSpeechInputSchema>;

const TextToSpeechOutputSchema = z.object({
  media: z.string(),
});
export type TextToSpeechOutput = z.infer<typeof TextToSpeechOutputSchema>;

const VOXTRAL_TTS_BASE = 'http://localhost:8000/v1';
const PIPER_BASE = 'http://localhost:8080';

export async function textToSpeech(input: TextToSpeechInput): Promise<TextToSpeechOutput> {
  const text = typeof input === 'string' ? input : input.text;
  const provider = typeof input === 'string' ? 'piper' : (input.provider || 'piper');
  
  console.log('[textToSpeech] Provider:', provider, 'Input:', text.substring(0, 50));

  if (provider === 'voxtral_tts') {
    if (typeof input === 'string') {
      const voice = 'en_us_aria';
      const emotion = 'neutral';
      return textToSpeechVoxtral(text, voice, emotion);
    }
    return textToSpeechVoxtral(
      text, 
      input.voice || 'en_us_aria', 
      input.emotion || 'neutral'
    );
  }
  
  return textToSpeechPiper(text, input.voice || 'en_GB-alan-medium');
}

async function textToSpeechPiper(text: string, voice: string): Promise<TextToSpeechOutput> {
  console.log('[textToSpeechPiper] Voice:', voice);
  
  try {
    const response = await fetch(`${PIPER_BASE}/tts`, {
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
    
    console.log('[textToSpeechPiper] Generated:', arrayBuffer.byteLength, 'bytes');
    return { media: mediaUrl };
  } catch (error) {
    console.error('[textToSpeechPiper] Error:', error);
    throw error;
  }
}

async function textToSpeechVoxtral(text: string, voice: string, emotion: string = 'neutral'): Promise<TextToSpeechOutput> {
  console.log('[textToSpeechVoxtral] Voice:', voice, 'Emotion:', emotion);
  
  const model = 'voxtral-4b-tts-2603-mlx-4bit';
  
  try {
    const response = await fetch(`${VOXTRAL_TTS_BASE}/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        input: text,
        voice: voice,
        emotion: emotion,
        response_format: 'wav'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[textToSpeechVoxtral] Error response:', errorText);
      throw new Error(`Voxtral TTS failed: ${response.status} - ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);
    const mediaUrl = `data:audio/wav;base64,${base64}`;
    
    console.log('[textToSpeechVoxtral] Generated:', arrayBuffer.byteLength, 'bytes');
    return { media: mediaUrl };
  } catch (error) {
    console.error('[textToSpeechVoxtral] Error:', error);
    throw error;
  }
}