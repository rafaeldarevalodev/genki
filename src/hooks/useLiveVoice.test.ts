import { describe, expect, it } from 'vitest';
import { getMayaTTSSelection } from './useLiveVoice';

describe('getMayaTTSSelection', () => {
  it.each(['piper', 'vibevoice7b', 'unknown'])('falls back from stale %s settings to F5-TTS', (ttsProvider) => {
    expect(getMayaTTSSelection({
      ttsProvider,
      kokoroVoice: 'af_sarah',
      f5ttsVoice: 'en-Davis_man',
    }, true)).toEqual({ provider: 'f5tts', voice: 'en-Davis_man' });
  });

  it('keeps the selected Kokoro voice', () => {
    expect(getMayaTTSSelection({
      ttsProvider: 'kokoro',
      kokoroVoice: 'af_sarah',
      f5ttsVoice: 'en-Davis_man',
    }, true)).toEqual({ provider: 'kokoro', voice: 'af_sarah' });
  });

  it('uses the unloaded-settings F5-TTS default', () => {
    expect(getMayaTTSSelection(null, false)).toEqual({ provider: 'f5tts', voice: 'en-Emma_woman' });
  });
});
