import { beforeEach, describe, expect, it, vi } from 'vitest';

const getTTSConfig = vi.hoisted(() => vi.fn());
const getF5TTSConfig = vi.hoisted(() => vi.fn());
const getKokoroConfig = vi.hoisted(() => vi.fn());

vi.mock('@/ai/llm', () => ({ getTTSConfig, getF5TTSConfig, getKokoroConfig }));

import { textToSpeech } from './text-to-speech';

describe('textToSpeech provider dispatch', () => {
  beforeEach(() => {
    getTTSConfig.mockReturnValue({
      provider: 'kokoro',
      endpoint: 'http://configured-provider.test',
      voice: 'af_bella',
    });
    getF5TTSConfig.mockReturnValue({ provider: 'f5tts', endpoint: 'http://f5.test', voice: 'en-Emma_woman' });
    getKokoroConfig.mockReturnValue({ provider: 'kokoro', endpoint: 'http://kokoro.test', voice: 'af_bella' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array([1]))));
  });

  it.each(['piper', 'vibevoice7b'])('normalizes retired %s input to F5-TTS dispatch', async (provider) => {
    await textToSpeech({ text: 'Hello', provider });

    expect(fetch).toHaveBeenCalledWith('http://f5.test/tts', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ text: 'Hello.', voice: 'en-Emma_woman' }),
    }));
  });

  it('keeps a Kokoro input on the Kokoro dispatch path', async () => {
    await textToSpeech({ text: 'Hello.', provider: 'kokoro' });

    expect(fetch).toHaveBeenCalledWith('http://kokoro.test/v1/audio/speech', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ input: 'Hello.', voice: 'af_bella', speed: 1.0 }),
    }));
  });
});
