'use client';

import { useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Card as CardType } from '@/lib/types';
import TTSButton from '@/components/tts-button';

export default function AnalyzedText({ text, cards }: { text: string; cards: CardType[] }) {
  const content = useMemo(() => {
    if (!cards || cards.length === 0) {
      return <div className="whitespace-pre-wrap">{text}</div>;
    }
    
    // Simple approach: just show the full text with interactive cards below
    // This avoids the complex string matching issues
    return (
      <div className="space-y-6">
        <div className="whitespace-pre-wrap text-xl leading-relaxed text-slate-700">
          {text}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {cards.map((card, index) => (
            <Popover key={index}>
              <PopoverTrigger asChild>
                <button className="text-left bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl px-4 py-3 transition-colors">
                  {card.front}
                </button>
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
          ))}
        </div>
      </div>
    );
  }, [cards, text]);

  return content;
}
