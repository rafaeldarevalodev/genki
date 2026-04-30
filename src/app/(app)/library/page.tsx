'use client';

import { useDecks } from '@/hooks/use-decks';
import { DeckCard } from '@/components/deck-card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';

export default function LibraryPage() {
  const { decks, isLoaded } = useDecks();

  return (
    <div className="space-y-12 animate-in fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <h2 className="text-4xl md:text-5xl font-black font-headline">Your Decks</h2>
        <Button asChild size="lg" className="w-full md:w-auto bg-indigo-600 text-white px-8 py-8 rounded-[2rem] font-black shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all text-base">
          <Link href="/creator">
            <Plus size={24} strokeWidth={3} /> New AI Deck
          </Link>
        </Button>
      </div>
      
      {!isLoaded ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-[280px] rounded-[2.5rem]" />
          ))}
        </div>
      ) : decks.length === 0 ? (
        <div className="col-span-full py-20 text-center text-slate-400 font-medium">
          <p>Your library is empty.</p>
          <p>Click &quot;New AI Deck&quot; to get started!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {decks.map((deck) => (
            <DeckCard key={deck.id} deck={deck} />
          ))}
        </div>
      )}
    </div>
  );
}
