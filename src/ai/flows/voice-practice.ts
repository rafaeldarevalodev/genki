'use server';

import { z } from 'genkit';
import { config } from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
config({ path: envPath });

const VoicePracticeInputSchema = z.object({
  text: z.string(),
  audio: z.string(), // base64 audio from microphone
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
const VOXTRAL_TTS_BASE = 'http://localhost:8000/v1';

const VOICE_EMOTION_MAP: Record<string, string> = {
  neutral: 'neutral_male',
  cheerful: 'cheerful_female',
  excited: 'casual_male',
  empathetic: 'casual_female',
};

function getRandomVoice(): { voice: string } {
  const voices = [
    { voice: 'casual_male' },
    { voice: 'casual_female' },
    { voice: 'neutral_male' },
    { voice: 'cheerful_female' },
  ];
  return voices[Math.floor(Math.random() * voices.length)];
}

export async function generateReferenceAudio(text: string): Promise<string> {
  const { voice } = getRandomVoice();
  
  // Ensure proper ending for complete audio (avoid cut-off words)
  const normalizedText = text.trim().match(/[.!?]$/) ? text : text + '.';
  
  const response = await fetch(`${VOXTRAL_TTS_BASE}/audio/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: normalizedText,
      voice: voice,
      response_format: 'wav'
    })
  });

  if (!response.ok) {
    throw new Error(`TTS failed: ${response.status}`);
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

  // Check health first
  const healthResponse = await fetch(`${VOICE_EVAL_API}/health`);
  const health = await healthResponse.json();
  console.log('[voicePractice] Health:', health);

  // Use MFA evaluator (stub) for now - provides phoneme details
  try {
    const formData = new FormData();
    // Convert base64 to blob
    const audioBytes = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
    const blob = new Blob([audioBytes], { type: 'audio/wav' });
    formData.append('audio', blob, 'audio.wav');
    formData.append('target_text', text);
    formData.append('evaluator', 'mfa');
    formData.append('language', language);

    console.log('[voicePractice] Sending to Voice Eval API...');
    
    const response = await fetch(`${VOICE_EVAL_API}/evaluate`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[voicePractice] API error:', errorText);
      throw new Error(`Evaluation failed: ${response.status}`);
    }

    const result = await response.json();
    console.log('[voicePractice] Result:', result);
    
    return result;
  } catch (error) {
    console.error('[voicePractice] Error:', error);
    throw error;
  }
}