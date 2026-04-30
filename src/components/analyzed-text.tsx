'use client';

import { useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Card as CardType } from '@/lib/types';
import TTSButton from '@/components/tts-button';

export default function AnalyzedText({ text, cards }: { text: string; cards: CardType[] }) {
  const content = useMemo(() => {
    if (cards.length === 0) {
      return text;
    }
    
    return cards.map((card, index) => (
      <Popover key={index}>
        <PopoverTrigger asChild>
          <span className="bg-indigo-100 text-indigo-700 font-bold rounded-lg px-2 py-1 cursor-pointer hover:bg-indigo-200 transition-colors">
            {card.front}
          </span>
        </PopoverTrigger>
        <PopoverContent className="w-96 rounded-3xl shadow-2xl border-indigo-100">
          <div className="space-y-4">
            <h3 className="font-black text-2xl font-headline">{card.front}</h3>
            <TTSButton text={card.front} ipa={card.ipa} />
            <p className="text-lg font-semibold text-slate-600">{card.back}</p>
            <p className="text-sm italic text-slate-500 border-t pt-3">{card.explanation}</p>
          </div>
        </PopoverContent>
      </Popover>
    ));
  }, [cards, text]);

  return (
    <p className="text-2xl leading-loose font-medium text-slate-700">
      {content}
    </p>
  );
}
