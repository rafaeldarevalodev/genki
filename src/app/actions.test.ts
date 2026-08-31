import { beforeEach, describe, expect, it, vi } from 'vitest';

const textToSpeech = vi.hoisted(() => vi.fn());

vi.mock('@/ai/flows/text-to-speech', () => ({ textToSpeech }));

import { getTTSAudio } from './actions';

describe('getTTSAudio provider boundary', () => {
  beforeEach(() => {
    textToSpeech.mockReset();
    textToSpeech.mockResolvedValue({ media: 'data:audio/wav;base64,AA==' });
  });

  it.each(['piper', 'vibevoice7b'])('normalizes retired %s before invoking textToSpeech', async (provider) => {
    await getTTSAudio('Hello', 'en-Emma_woman', provider);

    expect(textToSpeech).toHaveBeenCalledWith({
      text: 'Hello',
      voice: 'en-Emma_woman',
      provider: 'f5tts',
    });
  });
});
