'use client';

import { useState, useMemo } from 'react';
import type { Deck } from '@/lib/types';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

interface GlossaryViewProps {
  deck: Deck;
}

export default function GlossaryView({ deck }: GlossaryViewProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCards = useMemo(() =>
    deck.cards.filter(
      (card) =>
        card.front.toLowerCase().includes(searchTerm.toLowerCase()) ||
        card.back.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [deck.cards, searchTerm]
  );

  return (
    <div className="space-y-6">
        <Input 
            placeholder="Search glossary..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
        />
      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <Table className="min-w-[1000px]">
            <TableHeader>
              <TableRow className="bg-slate-50/50 border-b border-slate-100 hover:bg-slate-50/50">
                <TableHead className="px-8 py-6 text-[10px] font-black uppercase text-slate-400">Chunk</TableHead>
                <TableHead className="px-8 py-6 text-[10px] font-black uppercase text-slate-400">Phonetics</TableHead>
                <TableHead className="px-8 py-6 text-[10px] font-black uppercase text-slate-400">Meaning</TableHead>
                <TableHead className="px-8 py-6 text-[10px] font-black uppercase text-slate-400">Why?</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-50">
              {filteredCards.map((card, idx) => (
                <TableRow key={idx} className="hover:bg-slate-50/30 transition-all">
                  <TableCell className="px-8 py-6 font-black text-slate-800 text-lg">{card.front}</TableCell>
                  <TableCell className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="font-code text-indigo-400 font-bold text-sm">{card.ipa}</span>
                      <span className="font-medium text-slate-400 italic text-xs">/{card.spanish_ipa}/</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-8 py-6 text-slate-600 font-medium">{card.back}</TableCell>
                  <TableCell className="px-8 py-6 text-slate-500 text-sm italic">{card.explanation}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
