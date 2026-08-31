export const SUPPORTED_TTS_PROVIDERS = ['f5tts', 'kokoro'] as const;
export type TTSProvider = (typeof SUPPORTED_TTS_PROVIDERS)[number];
export const DEFAULT_TTS_PROVIDER: TTSProvider = 'f5tts';

export function normalizeTTSProvider(value: unknown): TTSProvider {
  return value === 'f5tts' || value === 'kokoro' ? value : DEFAULT_TTS_PROVIDER;
}
