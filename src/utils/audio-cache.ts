const MAX_CACHE_ENTRIES = 30;
const MAX_TEXT_LENGTH = 200;
const CACHE_PREFIX = 'genki_audio_';

function hashText(text: string): string {
  return btoa(unescape(encodeURIComponent(text))).slice(0, 32);
}

function makeCacheKey(provider: string, voice: string, text: string): string {
  return `${CACHE_PREFIX}${provider}_${voice}_${hashText(text)}`;
}

export function getCachedAudio(text: string, provider: string, voice: string): string | null {
  if (text.length > MAX_TEXT_LENGTH) return null;

  const key = makeCacheKey(provider, voice, text);
  return sessionStorage.getItem(key);
}

export function setCachedAudio(text: string, provider: string, voice: string, audioData: string): void {
  if (text.length > MAX_TEXT_LENGTH) return;

  const key = makeCacheKey(provider, voice, text);

  evictIfNeeded();

  try {
    sessionStorage.setItem(key, audioData);
  } catch {
    console.warn('[AudioCache] Failed to cache audio');
  }
}

function evictIfNeeded(): void {
  const keys: string[] = [];

  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) {
      keys.push(key);
    }
  }

  while (keys.length >= MAX_CACHE_ENTRIES) {
    const oldestKey = keys.shift();
    if (oldestKey) {
      sessionStorage.removeItem(oldestKey);
    }
  }
}

export function clearAudioCache(): void {
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) {
      sessionStorage.removeItem(key);
    }
  }
}

export function getCacheStats(): { entries: number; maxEntries: number } {
  let count = 0;
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) {
      count++;
    }
  }
  return { entries: count, maxEntries: MAX_CACHE_ENTRIES };
}
