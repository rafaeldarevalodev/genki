'use client';

import { useState } from 'react';
import { Loader2, Volume2 } from 'lucide-react';
import { getTTSAudio } from '@/app/actions';

interface TTSButtonProps {
  text: string;
  ipa: string;
  emotion?: 'neutral' | 'cheerful' | 'empathetic' | 'excited';
}

export default function TTSButton({ text, ipa, emotion: propEmotion }: TTSButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handlePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLoading) return;
    setIsLoading(true);

    const provider = localStorage.getItem('tts-provider') || 'piper';
    let voice: string;
    let emotion: string;
    
    if (provider === 'voxtral_tts') {
      voice = localStorage.getItem('lmstudio-voice') || 'en_us_aria';
      emotion = propEmotion || localStorage.getItem('lmstudio-emotion') || 'neutral';
    } else {
      voice = localStorage.getItem('tts-voice') || 'en_GB-alan-medium';
      emotion = 'neutral';
    }
    
    const cacheKey = `genki_audio_${provider}_${voice}_${emotion}_${btoa(unescape(encodeURIComponent(text))).slice(0, 32)}`;
    let audioDataUrl = localStorage.getItem(cacheKey);

    if (!audioDataUrl) {
      console.log(`[TTSButton] Fetching audio: provider=${provider}, voice=${voice}, emotion=${emotion}`);
      const fetchedAudioData = await getTTSAudio(text, voice, provider, emotion);
      if (fetchedAudioData && fetchedAudioData.media) {
        audioDataUrl = fetchedAudioData.media;
        
        // Try to cache but handle quota errors gracefully
        try {
          // Check available space before saving (keep under 4MB to leave room for other data)
          const testKey = 'genki_storage_test';
          localStorage.setItem(testKey, '');
          localStorage.removeItem(testKey);
          
          // Only cache if audio is under 3MB
          if (audioDataUrl.length < 4 * 1024 * 1024) {
            localStorage.setItem(cacheKey, audioDataUrl);
          } else {
            console.log('[TTSButton] Audio too large to cache, playing without caching');
          }
        } catch (e) {
          if (e instanceof DOMException && e.name === 'QuotaExceededError') {
            console.log('[TTSButton] Storage full, clearing old cache and retrying...');
            // Clear oldest entries
            clearOldestAudioCache(5);
            try {
              localStorage.setItem(cacheKey, audioDataUrl);
            } catch {
              console.log('[TTSButton] Could not cache even after clearing, skipping cache');
            }
          }
        }
      }
    }

    if (audioDataUrl) {
      const audio = new Audio(audioDataUrl);
      audio.onended = () => setIsLoading(false);
      audio.onerror = () => setIsLoading(false);
      
      // Resume AudioContext on user interaction
      if (audio.context?.state === 'suspended') {
        audio.context.resume();
      }
      
      audio.play().catch(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  };

  // Clear oldest audio entries from localStorage to free space
  function clearOldestAudioCache(count: number) {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('genki_audio_'));
    keys.sort((a, b) => {
      const timeA = localStorage.getItem(a + '_time') || '0';
      const timeB = localStorage.getItem(b + '_time') || '0';
      return parseInt(timeA) - parseInt(timeB);
    });
    for (let i = 0; i < Math.min(count, keys.length); i++) {
      localStorage.removeItem(keys[i]);
      localStorage.removeItem(keys[i] + '_time');
    }
  }

  return (
    <div
      onClick={handlePlay}
      className="flex items-center gap-4 bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100 transition-all hover:bg-slate-100 cursor-pointer"
    >
      <span className="text-indigo-400 font-bold font-code tracking-tight">{ipa}</span>
      <div
        className={`p-2 rounded-full ${
          isLoading
            ? 'bg-indigo-600 text-white animate-pulse'
            : 'bg-white text-indigo-600 shadow-sm'
        }`}
      >
        {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Volume2 size={20} />}
      </div>
    </div>
  );
}