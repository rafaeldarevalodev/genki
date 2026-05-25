'use client';

import { useState, useRef, useEffect } from 'react';
import { Loader2, Volume2 } from 'lucide-react';
import { getTTSAudio } from '@/app/actions';
import { useSettings } from '@/hooks/use-settings';
import { getCachedAudio, setCachedAudio } from '@/utils/audio-cache';

interface TTSButtonProps {
  text: string;
  ipa?: string;
}

export default function TTSButton({ text, ipa }: TTSButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentRequestRef = useRef(0);
  const { settings, isLoaded } = useSettings();

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  const handlePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!isLoaded || !settings) {
      console.log('[TTSButton] Settings not loaded yet');
      return;
    }
    
    if (isLoading) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        setIsLoading(false);
      }
      return;
    }
    
    setIsLoading(true);

    const provider = settings.ttsProvider;
    const voice = provider === 'kokoro'
        ? settings.kokoroVoice
        : provider === 'vibevoice7b'
          ? settings.vibevoice7bVoice
          : provider === 'f5tts'
            ? settings.f5ttsVoice
            : settings.voice;
    
    console.log('[TTSButton] Using provider:', provider, 'voice:', voice);

    // Check cache first (only for short texts)
    const cachedAudio = getCachedAudio(text, provider, voice);
    if (cachedAudio) {
      console.log('[TTSButton] Using cached audio');
      const audio = new Audio(cachedAudio);
      audioRef.current = audio;
      audio.playbackRate = settings.playbackSpeed || 1;
      audio.onended = () => {
        setIsLoading(false);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setIsLoading(false);
        audioRef.current = null;
      };
      await audio.play();
      setIsLoading(false);
      return;
    }

    const requestId = ++currentRequestRef.current;
    
    try {
      const result = await getTTSAudio(text, voice, provider);
      
      if (requestId !== currentRequestRef.current) {
        return;
      }
      
      if (result?.media) {
        setCachedAudio(text, provider, voice, result.media);

        const audio = new Audio(result.media);
        audioRef.current = audio;
        audio.playbackRate = settings.playbackSpeed || 1;
        
        audio.onended = () => {
          setIsLoading(false);
          audioRef.current = null;
        };
        
        audio.onerror = () => {
          setIsLoading(false);
          audioRef.current = null;
        };
        
        await audio.play();
      } else {
        setIsLoading(false);
      }
    } catch (e) {
      if (requestId !== currentRequestRef.current) {
        return;
      }
      setIsLoading(false);
    }
  };

  return (
    <div
      onClick={handlePlay}
      className="flex items-center gap-4 bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100 transition-all hover:bg-slate-100 cursor-pointer"
    >
      {ipa && <span className="text-indigo-400 font-bold font-code tracking-tight">{ipa}</span>}
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