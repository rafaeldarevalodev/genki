'use server';

import { z } from 'zod';
import { config } from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
config({ path: envPath });

const VoicePracticeInputSchema = z.object({
  text: z.string(),
  audio: z.string(),
  language: z.string().optional().default('en'),
});
export type VoicePracticeInput = z.infer<typeof VoicePracticeInputSchema>;

const VoicePracticeOutputSchema = z.object({
  score: z.number(),
  transcription: z.string(),
  target_text: z.string(),
  phoneme_details: z.array(z.object({
    phoneme: z.string(),
    start: z.number(),
    end: z.number(),
    confidence: z.number(),
    status: z.enum(['correct', 'warning', 'error']),
  })),
  feedback_text: z.string(),
  processing_time_ms: z.number(),
  evaluator_name: z.string(),
});
export type VoicePracticeOutput = z.infer<typeof VoicePracticeOutputSchema>;

const VOICE_EVAL_API = 'http://localhost:10301';
const KOKORO_TTS_BASE = 'http://localhost:8880/v1/audio/speech';

const KOKORO_VOICES = [
  'af_bella',
  'af_nicole', 
  'af_sarah',
  'af_sky',
  'am_adam',
  'am_eric',
  'am_michael',
];

function getRandomVoice(): string {
  return KOKORO_VOICES[Math.floor(Math.random() * KOKORO_VOICES.length)];
}

export async function generateReferenceAudio(text: string): Promise<string> {
  const voice = getRandomVoice();
  
  const normalizedText = text.trim().match(/[.!?]$/) ? text : text + '.';
  
  const response = await fetch(`${KOKORO_TTS_BASE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: normalizedText,
      voice: voice,
      response_format: 'wav'
    })
  });

  if (!response.ok) {
    throw new Error(`Kokoro TTS failed: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

export async function voicePractice(input: VoicePracticeInput): Promise<VoicePracticeOutput> {
  const { text, audio, language } = input;

  console.log('[voicePractice] Text:', text, 'Audio length:', audio.length);

  const healthResponse = await fetch(`${VOICE_EVAL_API}/health`);
  const health = await healthResponse.json();
  console.log('[voicePractice] Health:', health);

  const audioBytes = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
  const blob = new Blob([audioBytes], { type: 'audio/wav' });

  async function evaluateWithEvaluator(evaluator: string): Promise<VoicePracticeOutput> {
    const formData = new FormData();
    formData.append('audio', blob, 'audio.wav');
    formData.append('target_text', text);
    formData.append('evaluator', evaluator);
    formData.append('language', language);

    console.log(`[voicePractice] Sending to Voice Eval API with evaluator=${evaluator}...`);

    const response = await fetch(`${VOICE_EVAL_API}/evaluate`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[voicePractice] API error (${evaluator}):`, errorText);
      throw new Error(`Evaluation failed: ${response.status}`);
    }

    const result = await response.json();
    console.log('[voicePractice] Result:', result);
    return result;
  }

  try {
    return await evaluateWithEvaluator('whisper');
  } catch (error) {
    if (error instanceof Error && error.message.includes('503')) {
      console.warn('[voicePractice] Whisper unavailable (503), falling back to difflib...');
      return await evaluateWithEvaluator('difflib');
    }
    throw error;
  }
}