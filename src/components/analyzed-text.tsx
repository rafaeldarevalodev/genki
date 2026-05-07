'use client';

import { useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Card as CardType } from '@/lib/types';
import TTSButton from '@/components/tts-button';

export default function AnalyzedText({ text, cards }: { text: string; cards: CardType[] }) {
  const content = useMemo(() => {
    if (!cards || cards.length === 0) {
      return <span className="whitespace-pre-wrap">{text}</span>;
    }
    
    // Create a map of chunk -> card for quick lookup
    const cardMap = new Map<string, CardType>();
    cards.forEach(card => {
      cardMap.set(card.front, card);
    });
    
    // Split text by chunks using regex that matches any card.front
    const chunks = cards.map(c => c.front).filter(Boolean);
    if (chunks.length === 0) {
      return <span className="whitespace-pre-wrap">{text}</span>;
    }
    
    // Create regex pattern that matches any chunk
    const pattern = new RegExp(`(${chunks.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
    
    // Split text by chunks
    const parts = text.split(pattern);
    
    return (
      <span className="whitespace-pre-wrap">
        {parts.map((part, index) => {
          const card = cardMap.get(part);
          
          if (card) {
            return (
              <Popover key={index}>
                <PopoverTrigger asChild>
                  <span className="inline-flex mx-0.5 bg-indigo-100 text-indigo-700 font-bold rounded-lg px-2 py-0.5 cursor-pointer hover:bg-indigo-200 transition-colors">
                    {part}
                  </span>
                </PopoverTrigger>
                <PopoverContent className="w-80 rounded-2xl shadow-xl border-indigo-100 p-4">
                  <div className="space-y-3">
                    <h3 className="font-bold text-lg text-indigo-900">{card.front}</h3>
                    <TTSButton text={card.front} />
                    <p className="text-slate-600 font-medium">{card.back}</p>
                    {card.ipa && <p className="text-xs font-mono text-slate-400">{card.ipa}</p>}
                    {card.explanation && (
                      <p className="text-sm italic text-slate-500 border-t pt-2">{card.explanation}</p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            );
          }
          
          return part;
        })}
      </span>
    );
  }, [cards, text]);

  return (
    <div className="text-xl leading-relaxed text-slate-700">
      {content}
    </div>
  );
}
