import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const envFile = vi.hoisted(() => ({ contents: '', writes: [] as string[] }));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  const existsSync = vi.fn(() => true);
  const readFileSync = vi.fn(() => envFile.contents);
  const writeFileSync = vi.fn((_path: string, contents: string) => {
    envFile.contents = contents;
    envFile.writes.push(contents);
  });

  return {
    ...actual,
    existsSync,
    readFileSync,
    writeFileSync,
    default: { ...actual, existsSync, readFileSync, writeFileSync },
  };
});

import { GET, POST } from './route';

describe('/api/settings retired TTS migration', () => {
  beforeEach(() => {
    envFile.contents = '';
    envFile.writes = [];
  });

  it('migrates and persists a stale VibeVoice provider during GET', async () => {
    envFile.contents = [
      'TTS_PROVIDER=vibevoice7b',
      'TTS_VOICE=en_GB-alan-medium',
      'TTS_VIBEVOICE7B_VOICE=en-Emma_woman',
      'TTS_VIBEVOICE7B_MODEL=vibevoice-7b',
      'TTS_ENDPOINT=http://localhost:8093/tts',
      'TTS_KOKORO_VOICE=af_bella',
      'TTS_F5TTS_VOICE=en-Emma_woman',
    ].join('\n');

    const response = await GET();
    const body = await response.json();

    expect(body.ttsProvider).toBe('f5tts');
    expect(envFile.contents).toContain('TTS_PROVIDER=f5tts');
    expect(envFile.contents).not.toMatch(/^TTS_VOICE=/m);
    expect(envFile.contents).not.toMatch(/^TTS_VIBEVOICE7B_/m);
    expect(envFile.contents).not.toMatch(/^TTS_ENDPOINT=/m);
  });

  it('preserves retained TTS base URLs while cleaning retired settings during GET', async () => {
    envFile.contents = [
      'TTS_PROVIDER=vibevoice7b',
      'TTS_F5TTS_BASE_URL=http://localhost:7860',
      'TTS_KOKORO_BASE_URL=http://localhost:8880',
      'TTS_VIBEVOICE7B_MODEL=vibevoice-7b',
      'TTS_ENDPOINT=http://localhost:8093/tts',
    ].join('\n');

    await GET();

    expect(envFile.contents).toContain('TTS_PROVIDER=f5tts');
    expect(envFile.contents).toContain('TTS_F5TTS_BASE_URL=http://localhost:7860');
    expect(envFile.contents).toContain('TTS_KOKORO_BASE_URL=http://localhost:8880');
    expect(envFile.contents).not.toMatch(/^TTS_VIBEVOICE7B_/m);
    expect(envFile.contents).not.toMatch(/^TTS_ENDPOINT=/m);
  });

  it('cleans retired settings during GET when f5tts is already valid', async () => {
    envFile.contents = [
      'TTS_PROVIDER=f5tts',
      'TTS_F5TTS_BASE_URL=http://localhost:7860',
      'TTS_KOKORO_BASE_URL=http://localhost:8880',
      'TTS_VIBEVOICE7B_MODEL=vibevoice-7b',
      'TTS_ENDPOINT=http://localhost:8093/tts',
    ].join('\n');

    await GET();

    expect(envFile.contents).toContain('TTS_PROVIDER=f5tts');
    expect(envFile.contents).toContain('TTS_F5TTS_BASE_URL=http://localhost:7860');
    expect(envFile.contents).toContain('TTS_KOKORO_BASE_URL=http://localhost:8880');
    expect(envFile.contents).not.toMatch(/^TTS_VIBEVOICE7B_/m);
    expect(envFile.contents).not.toMatch(/^TTS_ENDPOINT=/m);
  });

  it('refuses a retired provider value during POST', async () => {
    envFile.contents = [
      'TTS_VOICE=en_GB-alan-medium',
      'TTS_VIBEVOICE7B_VOICE=en-Emma_woman',
      'TTS_VIBEVOICE7B_MODEL=vibevoice-7b',
      'TTS_ENDPOINT=http://localhost:8093/tts',
    ].join('\n');

    const response = await POST(new NextRequest('http://localhost/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ttsProvider: 'vibevoice7b',
        voice: 'en_GB-alan-medium',
        vibevoice7bVoice: 'en-Emma_woman',
      }),
    }));

    expect(await response.json()).toEqual({ success: true });
    expect(envFile.contents).toContain('TTS_PROVIDER=f5tts');
    expect(envFile.contents).not.toMatch(/^TTS_VOICE=/m);
    expect(envFile.contents).not.toMatch(/^TTS_VIBEVOICE7B_/m);
    expect(envFile.contents).not.toMatch(/^TTS_ENDPOINT=/m);
  });

  it('preserves retained TTS base URLs and removes retired settings during POST with f5tts', async () => {
    envFile.contents = [
      'TTS_F5TTS_BASE_URL=http://localhost:7860',
      'TTS_KOKORO_BASE_URL=http://localhost:8880',
      'TTS_VIBEVOICE7B_VOICE=en-Emma_woman',
      'TTS_ENDPOINT=http://localhost:8093/tts',
    ].join('\n');

    await POST(new NextRequest('http://localhost/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttsProvider: 'f5tts' }),
    }));

    expect(envFile.contents).toContain('TTS_PROVIDER=f5tts');
    expect(envFile.contents).toContain('TTS_F5TTS_BASE_URL=http://localhost:7860');
    expect(envFile.contents).toContain('TTS_KOKORO_BASE_URL=http://localhost:8880');
    expect(envFile.contents).not.toMatch(/^TTS_VIBEVOICE7B_/m);
    expect(envFile.contents).not.toMatch(/^TTS_ENDPOINT=/m);
  });

  it('returns only retained TTS voice fields during GET', async () => {
    envFile.contents = [
      'TTS_PROVIDER=kokoro',
      'TTS_KOKORO_VOICE=af_bella',
      'TTS_F5TTS_VOICE=en-Emma_woman',
    ].join('\n');

    const body = await (await GET()).json();

    expect(body).toMatchObject({
      ttsProvider: 'kokoro',
      kokoroVoice: 'af_bella',
      f5ttsVoice: 'en-Emma_woman',
    });
    expect(body).not.toHaveProperty('voice');
    expect(body).not.toHaveProperty('vibevoice7bVoice');
  });
});
