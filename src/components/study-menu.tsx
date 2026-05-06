'use client';

import { CalendarCheck, RotateCcw, Target, MessageSquare, List, Clock, FileText, Mic } from 'lucide-react';
import type { Deck } from '@/lib/types';
import { getDueCount } from '@/lib/srs';

type StudyMode = 'menu' | 'flashcards' | 'quiz' | 'roleplay' | 'glossary' | 'reading' | 'voice';

interface StudyMenuProps {
  deck: Deck;
  onSelectMode: (mode: StudyMode, isSrs?: boolean) => void;
}

export default function StudyMenu({ deck, onSelectMode }: StudyMenuProps) {
  const dueCount = getDueCount(deck);

  const menuItems = [
    { id: 'quiz', title: 'Smart Quiz', icon: Target },
    { id: 'roleplay', title: 'Roleplay', icon: MessageSquare },
    { id: 'glossary', title: 'Glossary', icon: List },
    { id: 'reading', title: 'Reading', icon: FileText },
    { id: 'voice', title: 'Voice Practice', icon: Mic },
  ];

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div
          className="bg-indigo-600 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden cursor-pointer hover:bg-indigo-700 transition-all active:scale-[0.98]"
          onClick={() => onSelectMode('flashcards', true)}
        >
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-white/20 p-3 rounded-2xl"><CalendarCheck size={32} /></div>
              <h3 className="text-3xl font-black font-headline">Daily Review</h3>
            </div>
            <p className="font-medium text-indigo-100 mb-6">Optimized for retention. Only cards due now.</p>
            <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl font-bold">
              <Clock size={16} /> Due: {dueCount} cards
            </div>
          </div>
          <div className="absolute -right-10 -bottom-10 opacity-20">
            <Target size={200} />
          </div>
        </div>
        <div
          className="bg-white text-slate-800 border border-slate-100 p-10 rounded-[3rem] shadow-xl relative overflow-hidden cursor-pointer hover:border-indigo-200 transition-all active:scale-[0.98]"
          onClick={() => onSelectMode('flashcards', false)}
        >
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-slate-100 text-slate-600 p-3 rounded-2xl"><RotateCcw size={32} /></div>
              <h3 className="text-3xl font-black font-headline">Cram Session</h3>
            </div>
            <p className="font-medium text-slate-400 mb-6">Study all cards. No SRS updates (Safe Mode).</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        {menuItems.map((m) => (
          <div
            key={m.id}
            onClick={() => onSelectMode(m.id as StudyMode)}
            className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-lg transition-all cursor-pointer text-center group"
          >
            <div className="bg-indigo-50 text-indigo-600 w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-all">
              <m.icon size={24} />
            </div>
            <h4 className="font-black font-headline text-xl">{m.title}</h4>
          </div>
        ))}
      </div>
    </div>
  );
}
