'use server';

import { z } from 'genkit';
import { getTTSConfig } from '@/ai/llm';

const TextToSpeechInputSchema = z.object({
  text: z.string(),
  provider: z.enum(['piper', 'voxtral']).optional(),
  voice: z.string().optional(),
  emotion: z.string().optional(),
});
export type TextToSpeechInput = z.infer<typeof TextToSpeechInputSchema>;

const TextToSpeechOutputSchema = z.object({
  media: z.string(),
});
export type TextToSpeechOutput = z.infer<typeof TextToSpeechOutputSchema>;

export async function textToSpeech(input: TextToSpeechInput): Promise<TextToSpeechOutput> {
  const ttsConfig = getTTSConfig();
  const text = typeof input === 'string' ? input : input.text;
  const provider = ttsConfig.provider;
  
  console.log('[textToSpeech] Provider from config:', provider);
  console.log('[textToSpeech] TTS Config:', ttsConfig);

  if (provider === 'piper') {
    const voice = input?.voice || ttsConfig.voice || 'en_GB-alan-medium';
    return textToSpeechPiper(text, voice);
  }
  
  // For Voxtral, use lmstudioVoice
  const voice = input?.voice || ttsConfig.lmstudioVoice || 'en_us_aria';
  const emotion = input?.emotion || ttsConfig.emotion || 'neutral';
  return textToSpeechVoxtral(text, voice, emotion);
}

async function textToSpeechPiper(text: string, voice: string): Promise<TextToSpeechOutput> {
  const ttsConfig = getTTSConfig();
  console.log('[textToSpeechPiper] Voice:', voice, 'Endpoint:', ttsConfig.endpoint);
  
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
    
    console.log('[textToSpeechPiper] Generated:', arrayBuffer.byteLength, 'bytes');
    return { media: mediaUrl };
  } catch (error) {
    console.error('[textToSpeechPiper] Error:', error);
    throw error;
  }
}

async function textToSpeechVoxtral(text: string, voice: string, emotion: string = 'neutral'): Promise<TextToSpeechOutput> {
  const ttsConfig = getTTSConfig();
  console.log('[textToSpeechVoxtral] Voice:', voice, 'Emotion:', emotion, 'Endpoint:', ttsConfig.endpoint);
  
  // Map frontend voice IDs to Voxtral voice embeddings
  // These IDs come from settings-modal.tsx
  const voiceMap: Record<string, string> = {
    'en_us_aria': 'casual_female',
    'en_us_zoe': 'cheerful_female',
    'en_us_james': 'casual_male',
    'en_gb_sophie': 'cheerful_female',
    'en_gb_oliver': 'neutral_male',
  };
  
  const voxtralVoice = voiceMap[voice] || 'casual_male';
  
  const model = 'voxtral-4b-tts-2603-mlx-4bit';
  
  try {
    const response = await fetch(`${ttsConfig.endpoint}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        input: text,
        voice: voxtralVoice,
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