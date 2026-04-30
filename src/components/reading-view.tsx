'use client';

import type { Deck } from '@/lib/types';
import AnalyzedText from './analyzed-text';
import { FileText } from 'lucide-react';

interface ReadingViewProps {
  deck: Deck;
}

export default function ReadingView({ deck }: ReadingViewProps) {
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

        <div className="bg-white p-8 md:p-16 rounded-[3rem] shadow-xl border border-slate-100">
            <AnalyzedText text={deck.sourceText} cards={deck.cards} />
        </div>
    </div>
  );
}
