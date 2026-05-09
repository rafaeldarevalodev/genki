'use client';

import { useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Card as CardType } from '@/lib/types';
import TTSButton from '@/components/tts-button';

export default function AnalyzedText({ text, cards }: { text: string; cards: CardType[] }) {
  // DEBUG: Log what we're receiving
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  AnalyzedText - RECEIVED DATA                              ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log('║  text length:', text.length);
  console.log('║  text (first 100 chars):', text.substring(0, 100));
  console.log('║  text char codes (first 20):', [...text.substring(0, 20)].map(c => c.charCodeAt(0)).join(', '));
  console.log('║  cards count:', cards.length);
  console.log('║  First 5 card fronts:', cards.slice(0, 5).map(c => `"${c.front}"`).join(', '));
  console.log('╚═══════════════════════════════════════════════════════════╝');

  const content = useMemo(() => {
    if (!cards || cards.length === 0) {
      return <span className="whitespace-pre-wrap">{text}</span>;
    }
    
    // Sort by length DESC so longer matches take priority (fixes "interface" vs "in" issue)
    const chunks = cards.map(c => c.front).filter(Boolean).sort((a, b) => b.length - a.length);
    
    // Create a map of chunk -> card for quick lookup (use original fronts as keys)
    const cardMap = new Map<string, CardType>();
    cards.forEach(card => {
      cardMap.set(card.front, card);
    });
    
    // DEBUG: Log chunks info
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║  AnalyzedText - REGEX PATTERN DEBUG                         ║');
    console.log('╠═══════════════════════════════════════════════════════════╣');
    console.log('║  chunks count:', chunks.length);
    console.log('║  sample chunks:', chunks.slice(0, 10).join(', '));
    
    if (chunks.length === 0) {
      console.log('║  ERROR: No chunks to match!');
      console.log('╚═══════════════════════════════════════════════════════════╝');
      return <span className="whitespace-pre-wrap">{text}</span>;
    }
    
    const escapedChunks = chunks.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const patternStr = `(${escapedChunks.join('|')})`;
    console.log('║  pattern string (first 300 chars):', patternStr.substring(0, 300));
    
    const pattern = new RegExp(patternStr, 'g');
    console.log('║  pattern regex:', pattern.toString().substring(0, 200));
    
    // Test split
    const parts = text.split(pattern);
    console.log('║  text split into', parts.length, 'parts');
    console.log('║  first 5 parts:', parts.slice(0, 5).map(p => `"${p}"`).join(', '));
    console.log('╚═══════════════════════════════════════════════════════════╝');
    
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
