import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { DEFAULT_TTS_PROVIDER, normalizeTTSProvider, type TTSProvider } from '../../../lib/tts-provider';

const ENV_PATH = join(process.cwd(), '.env.local');

interface SettingsData {
  provider?: 'local' | 'cloud';
  localModel?: 'gemma';
  cloudModel?: string;
  ttsProvider?: TTSProvider;
  kokoroVoice?: string;
  f5ttsVoice?: string;
  playbackSpeed?: number;
}

function readEnvFile(): Record<string, string> {
  const env: Record<string, string> = {};
  if (!existsSync(ENV_PATH)) return env;
  
  const content = readFileSync(ENV_PATH, 'utf-8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        env[key] = valueParts.join('=');
      }
    }
  });
  return env;
}

function writeEnvFile(env: Record<string, string>) {
  const lines = Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  writeFileSync(ENV_PATH, lines + '\n');
}

function removeRetiredTTSSettings(env: Record<string, string>) {
  const supportedKeys = new Set([
    'TTS_PROVIDER',
    'TTS_KOKORO_VOICE',
    'TTS_KOKORO_BASE_URL',
    'TTS_F5TTS_VOICE',
    'TTS_F5TTS_BASE_URL',
    'TTS_PLAYBACK_SPEED',
  ]);

  for (const key of Object.keys(env)) {
    if (key.startsWith('TTS_') && !supportedKeys.has(key)) {
      delete env[key];
    }
  }
}

export async function GET() {
  try {
    const env = readEnvFile();
    const ttsProvider = normalizeTTSProvider(env.TTS_PROVIDER);
    env.TTS_PROVIDER = ttsProvider;
    removeRetiredTTSSettings(env);
    writeEnvFile(env);

    return NextResponse.json({
      provider: env.LLM_PROVIDER || 'cloud',
      localModel: 'gemma',
      cloudModel: env.CLOUD_MODEL || 'moonshotai/kimi-k2.6',
      ttsProvider,
      kokoroVoice: env.TTS_KOKORO_VOICE || 'af_bella',
      f5ttsVoice: env.TTS_F5TTS_VOICE || 'en-Emma_woman',
      playbackSpeed: parseFloat(env.TTS_PLAYBACK_SPEED || '1'),
    });
  } catch (error) {
    console.error('Error reading settings:', error);
    return NextResponse.json({ error: 'Failed to read settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data: SettingsData = await request.json();
    const env = readEnvFile();
    
    if (data.provider) {
      env.LLM_PROVIDER = data.provider;
    }
    if (data.localModel) {
      env.LOCAL_MODEL_NAME = data.localModel;
    }
    if (data.cloudModel) {
      env.CLOUD_MODEL = data.cloudModel;
    }
    env.TTS_PROVIDER = normalizeTTSProvider(data.ttsProvider ?? DEFAULT_TTS_PROVIDER);
    if (data.kokoroVoice !== undefined) {
      env.TTS_KOKORO_VOICE = data.kokoroVoice;
    }
    if (data.f5ttsVoice !== undefined) {
      env.TTS_F5TTS_VOICE = data.f5ttsVoice;
    }
    if (data.playbackSpeed !== undefined) {
      env.TTS_PLAYBACK_SPEED = data.playbackSpeed.toString();
    }
    
    removeRetiredTTSSettings(env);
    writeEnvFile(env);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
