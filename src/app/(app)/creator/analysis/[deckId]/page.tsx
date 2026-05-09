'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDecks } from '@/hooks/use-decks';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Library } from 'lucide-react';
import AnalyzedText from '@/components/analyzed-text';

export default function AnalysisPage() {
  const router = useRouter();
  const params = useParams();
  const { decks, isLoaded } = useDecks();
  const deckId = params.deckId as string;

  const activeDeck = useMemo(
    () => {
      const found = decks.find((d) => d.id === deckId);
      console.log('╔═══════════════════════════════════════════════════════════╗');
      console.log('║  AnalysisPage - DECK LOOKUP DEBUG                           ║');
      console.log('╠═══════════════════════════════════════════════════════════╣');
      console.log('║  deckId:', deckId);
      console.log('║  found:', !!found);
      if (found) {
        console.log('║  deck.name:', found.name);
        console.log('║  deck.cards count:', found.cards.length);
        console.log('║  First 5 card fronts:', found.cards.slice(0, 5).map(c => `"${c.front}"`).join(', '));
        console.log('║  sourceText (first 50 chars):', found.sourceText.substring(0, 50));
      } else {
        console.log('║  Available deckIds:', decks.map(d => d.id).join(', '));
      }
      console.log('╚═══════════════════════════════════════════════════════════╝');
      return found;
    },
    [decks, deckId]
  );
  
  if (!isLoaded) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-8 w-1/4 mb-12" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    );
  }

  if (!activeDeck) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold">Deck not found</h2>
        <Button asChild className="mt-4">
          <Link href="/library">Go to Library</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in space-y-12">
      <div className="space-y-3">
        <h1 className="text-5xl font-black font-headline tracking-tighter">Text Analysis</h1>
        <p className="text-xl text-slate-500 font-medium">
          Here is your text with the AI-identified learning chunks highlighted. Click on a chunk to see details.
        </p>
      </div>
      <div className="bg-white p-8 md:p-16 rounded-[3rem] shadow-xl border border-slate-100">
        <AnalyzedText text={activeDeck.sourceText} cards={activeDeck.cards} />
        {activeDeck.sourceImages && activeDeck.sourceImages.length > 0 && (
           <div className="mt-8 border-t pt-8">
             <h3 className="font-bold text-slate-500 mb-4">Source Images</h3>
             <div className="flex flex-wrap gap-4">
              {activeDeck.sourceImages.map((img, i) => (
                <img key={i} src={img} alt={`Source content ${i+1}`} className="w-32 h-32 object-cover rounded-2xl border-2 border-white shadow-lg" />
              ))}
             </div>
           </div>
        )}
      </div>
      <Button onClick={() => router.push('/library')} size="lg" className="w-full bg-emerald-600 text-white py-8 rounded-[2.5rem] font-black text-2xl flex items-center justify-center gap-4 hover:bg-emerald-700 shadow-xl transition-all active:scale-95 h-auto">
        <Library />
        Save & Go to Library
      </Button>
    </div>
  );
}
