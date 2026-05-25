'use client';

import { useState, useMemo } from 'react';
import type { Deck } from '@/lib/types';
import AnalyzedText from './analyzed-text';
import { FileText, Play, Pause, Loader2 } from 'lucide-react';
import { getTTSAudio } from '@/app/actions';
import { useSettings } from '@/hooks/use-settings';
import AudioPlayer from './audio-player';

interface ReadingViewProps {
  deck: Deck;
}

export default function ReadingView({ deck }: ReadingViewProps) {
  const { settings, isLoaded } = useSettings();
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleListen = async () => {
    if (!isLoaded || !settings) return;
    
    // If already playing, just show the player
    if (audioUrl) {
      setIsPlaying(true);
      return;
    }
    
    setAudioLoading(true);
    
    try {
      const provider = settings.ttsProvider;
      const voice = provider === 'kokoro' 
        ? settings.kokoroVoice
        : provider === 'vibevoice7b'
          ? settings.vibevoice7bVoice
          : provider === 'f5tts'
            ? settings.f5ttsVoice
            : settings.voice;
      
      const result = await getTTSAudio(deck.sourceText, voice, provider);
      
      if (result?.media) {
        setAudioUrl(result.media);
      }
    } catch (e) {
      console.error('Failed to generate audio:', e);
    } finally {
      setAudioLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in">
        <div className="flex items-center gap-4">
            <div className="bg-indigo-50 text-indigo-600 p-4 rounded-2xl shadow-sm">
                <FileText size={28} />
            </div>
            <div>
                <h2 className="text-3xl md:text-4xl font-black font-headline">Reading Practice</h2>
                <p className="text-lg text-slate-500">Read the original text and click on chunks to review them.</p>
            </div>
        </div>

        {/* Audio Player Section */}
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
          <button
            onClick={handleListen}
            disabled={audioLoading}
            className="w-full flex items-center justify-center gap-3 py-4 px-8 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {audioLoading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : isPlaying || audioUrl ? (
              <Pause size={20} />
            ) : (
              <Play size={20} />
            )}
            {audioLoading ? 'Generating...' : 'Listen to Text'}
          </button>
          
          {audioUrl && (
            <div className="mt-4">
              <AudioPlayer 
                audioUrl={audioUrl} 
                onClose={() => { setAudioUrl(null); setIsPlaying(false); }}
              />
            </div>
          )}
        </div>

        <div className="bg-white p-8 md:p-16 rounded-[3rem] shadow-xl border border-slate-100">
            <AnalyzedText text={deck.sourceText} cards={deck.cards} />
        </div>
    </div>
  );
}
