'use client';

import { useState, useEffect, useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import type { Deck, Card } from '@/lib/types';
import { useDecks } from '@/hooks/use-decks';
import { getNextIntervalPreview, formatInterval } from '@/lib/srs';
import { Button } from '@/components/ui/button';
import TTSButton from './tts-button';
import { useToast } from '@/hooks/use-toast';
import PhraseExplorer from './phrase-explorer';

interface FlashcardViewProps {
  deck: Deck;
  isSrsMode: boolean;
  onSessionEnd: () => void;
}

export default function FlashcardView({ deck, isSrsMode, onSessionEnd }: FlashcardViewProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionQueue, setSessionQueue] = useState<number[]>([]);
  const { updateCardSrs, addXp } = useDecks();
  const { toast } = useToast();

  useEffect(() => {
    const now = Date.now();
    const initialQueue = isSrsMode
      ? deck.cards
          .map((c, i) => ({ ...c, originalIndex: i }))
          .filter((c) => !c.srs || !c.srs.nextReview || c.srs.nextReview <= now)
          .map((c) => c.originalIndex)
      : deck.cards.map((_, i) => i);
    
    if (isSrsMode && initialQueue.length === 0) {
      toast({ title: "All caught up!", description: "No cards are due for review." });
      onSessionEnd();
    } else {
      setSessionQueue(initialQueue);
      setCurrentIndex(0);
    }
  }, [deck, isSrsMode, onSessionEnd, toast]);

  const currentCard = useMemo(() => {
    if (sessionQueue.length > 0 && currentIndex < sessionQueue.length) {
      const cardIndex = sessionQueue[currentIndex];
      return deck.cards[cardIndex];
    }
    return null;
  }, [deck.cards, sessionQueue, currentIndex]);

  const handleSrsGrade = (quality: number) => {
    if (!currentCard) return;
    
    if (quality >= 4) {
      addXp(5); // Grant 5 XP for 'Good' or 'Easy'
    }

    const realIndex = sessionQueue[currentIndex];
    
    // Verificar que el índice sea válido antes de actualizar
    if (realIndex >= 0 && realIndex < deck.cards.length) {
      updateCardSrs(deck.id, realIndex, quality);
    } else {
      console.error('[handleSrsGrade] Invalid card index:', realIndex, 'deck length:', deck.cards.length);
    }
    
    setIsFlipped(false);
    
    let nextQueue = [...sessionQueue];
    if (quality <= 3) { // Again or Hard
      nextQueue.push(realIndex);
      setSessionQueue(nextQueue);
    }

    if (currentIndex + 1 < nextQueue.length) {
      setCurrentIndex(prev => prev + 1);
    } else {
      toast({ title: '🎉 Session Complete!', description: 'Great job, you finished your review.' });
      onSessionEnd();
    }
  };

  const handleNav = (direction: 'next' | 'prev') => {
    setIsFlipped(false);
    if (direction === 'next') {
      if (currentIndex < sessionQueue.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        onSessionEnd();
      }
    } else {
      setCurrentIndex(Math.max(0, currentIndex - 1));
    }
  };

  if (!currentCard) {
    return <div className="text-center py-10 font-bold text-slate-500">Loading session...</div>;
  }

  const srsButtons = [
    { label: 'Again', q: 0, color: 'rose' },
    { label: 'Hard', q: 3, color: 'orange' },
    { label: 'Good', q: 4, color: 'emerald' },
    { label: 'Easy', q: 5, color: 'blue' },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in zoom-in-95">
      {isSrsMode && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {srsButtons.map(btn => (
            <button
              key={btn.label}
              onClick={(e) => { e.stopPropagation(); handleSrsGrade(btn.q); }}
              className={`bg-${btn.color}-100 text-${btn.color}-700 py-4 rounded-2xl font-black hover:bg-${btn.color}-200 transition-all flex flex-col items-center`}
            >
              {btn.label}
              <span className="text-xs font-medium opacity-60 mt-1">
                {formatInterval(getNextIntervalPreview(currentCard, btn.q))}
              </span>
            </button>
          ))}
        </div>
      )}

      <div
        className="relative w-full aspect-[16/11] cursor-pointer perspective-2000 group"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div className={`relative w-full h-full transition-all duration-700 preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
          {/* Front */}
          <div className="absolute inset-0 bg-white border border-slate-50 rounded-[4rem] shadow-2xl flex flex-col items-center justify-center p-8 md:p-16 backface-hidden text-center">
            <span className="text-indigo-600 font-black text-sm uppercase mb-4 tracking-[0.3em] opacity-60 italic">Meaning Block</span>
            <h2 className="text-4xl md:text-5xl font-black text-slate-800 mb-8 tracking-tightest leading-tight font-headline">{currentCard.front}</h2>
            <div className="flex flex-col items-center gap-2 mb-8">
              <TTSButton text={currentCard.front} ipa={currentCard.ipa} />
              <span className="text-indigo-600 font-black italic text-xl tracking-tight bg-indigo-50 px-6 py-2 rounded-xl border border-indigo-100 mt-2">spa: {currentCard.spanish_phonetic}</span>
            </div>
            <div className="mt-auto text-slate-300 font-black uppercase text-xs tracking-widest flex items-center gap-2">
              <RotateCcw size={18} /> Tap to Flip
            </div>
          </div>
          {/* Back */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[4rem] shadow-2xl flex flex-col items-center justify-center p-8 md:p-16 backface-hidden rotate-y-180 text-center">
            <span className="text-indigo-200 font-black text-sm uppercase mb-6 tracking-[0.3em] opacity-40">Context & Meaning</span>
            <h2 className="text-3xl font-bold text-white leading-snug mb-4 font-headline">{currentCard.back}</h2>
            <div className="bg-white/10 p-4 rounded-2xl border border-white/10 text-indigo-100 text-sm font-medium italic">{currentCard.explanation}</div>
          </div>
        </div>
      </div>

      {isSrsMode ? (
        isFlipped ? null : (
          <Button onClick={() => setIsFlipped(true)} className="w-full bg-slate-900 text-white py-7 rounded-3xl font-black shadow-xl hover:scale-[1.02] transition-transform text-lg h-auto">Show Answer</Button>
        )
      ) : (
        <div className="flex gap-6">
          <Button onClick={() => handleNav('prev')} className="flex-1 bg-white py-6 rounded-3xl font-black text-slate-500 border border-slate-100 shadow-xl active:scale-95 transition-all text-base h-auto">Prev</Button>
          <Button onClick={() => handleNav('next')} className="flex-1 bg-indigo-600 text-white py-6 rounded-3xl font-black shadow-2xl active:scale-95 transition-all text-base h-auto">Next</Button>
        </div>
      )}

      <PhraseExplorer chunk={currentCard.front} />

      {isSrsMode && <div className="text-center text-slate-300 text-sm font-bold tracking-widest uppercase">Cards Left: {sessionQueue.length - currentIndex}</div>}
    </div>
  );
}
