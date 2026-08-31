import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TTS_PROVIDER,
  SUPPORTED_TTS_PROVIDERS,
  normalizeTTSProvider,
} from './tts-provider';

describe('TTS provider contract', () => {
  it.each(['f5tts', 'kokoro'])('retains supported provider %s', (provider) => {
    expect(normalizeTTSProvider(provider)).toBe(provider);
  });

  it.each([undefined, '', 'piper', 'vibevoice7b', 'unknown', null])(
    'migrates stale provider %p to F5-TTS',
    (provider) => {
      expect(normalizeTTSProvider(provider)).toBe(DEFAULT_TTS_PROVIDER);
    }
  );

  it('exports exactly the two selectable providers', () => {
    expect(SUPPORTED_TTS_PROVIDERS).toEqual(['f5tts', 'kokoro']);
  });
});
