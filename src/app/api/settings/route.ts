import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ENV_PATH = join(process.cwd(), '.env.local');

interface SettingsData {
  provider?: 'local' | 'cloud';
  localModel?: 'gemma' | 'voxtral';
  cloudModel?: string;
  ttsProvider?: 'piper' | 'voxtral';
  voice?: string;
  lmstudioVoice?: string;
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

export async function GET() {
  try {
    const env = readEnvFile();
    return NextResponse.json({
      provider: env.LLM_PROVIDER || 'local',
      localModel: env.LOCAL_MODEL_NAME || 'gemma',
      cloudModel: env.CLOUD_MODEL || '',
      ttsProvider: env.TTS_PROVIDER || 'piper',
      voice: env.TTS_VOICE || 'en_GB-alan-medium',
      lmstudioVoice: env.TTS_VOXTRAL_VOICE || 'en_us_aria',
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
    if (data.ttsProvider) {
      env.TTS_PROVIDER = data.ttsProvider;
    }
    if (data.voice) {
      env.TTS_VOICE = data.voice;
    }
    if (data.lmstudioVoice) {
      env.TTS_VOXTRAL_VOICE = data.lmstudioVoice;
    }
    
    writeEnvFile(env);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}