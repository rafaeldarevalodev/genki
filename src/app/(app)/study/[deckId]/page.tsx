'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Target, MessageSquare, List } from 'lucide-react';
import { useDecks } from '@/hooks/use-decks';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getDueCount } from '@/lib/srs';

import StudyMenu from '@/components/study-menu';
import FlashcardView from '@/components/flashcard-view';
import QuizView from '@/components/quiz-view';
import RoleplayView from '@/components/roleplay-view';
import GlossaryView from '@/components/glossary-view';
import ReadingView from '@/components/reading-view';

type StudyMode = 'menu' | 'flashcards' | 'quiz' | 'roleplay' | 'glossary' | 'reading';

export default function StudyPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { decks, isLoaded } = useDecks();

  const deckId = params.deckId as string;
  const mode = (searchParams.get('mode') as StudyMode) || 'menu';
  const srs = searchParams.get('srs') === 'true';

  const activeDeck = useMemo(
    () => decks.find((d) => d.id === deckId),
    [decks, deckId]
  );
  
  const setMode = (newMode: StudyMode, isSrs: boolean | null = null) => {
    const url = new URL(window.location.href);
    url.searchParams.set('mode', newMode);
    if (isSrs !== null) {
      url.searchParams.set('srs', String(isSrs));
    } else {
      url.searchParams.delete('srs');
    }
    router.push(url.toString());
  };

  if (!isLoaded) {
    return (
      <div className="max-w-6xl mx-auto space-y-16">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full rounded-[3rem]" />
      </div>
    );
  }

  if (!activeDeck) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold">Deck not found</h2>
        <p className="text-slate-500">
          The deck you are looking for does not exist.
        </p>
        <Button asChild className="mt-4">
          <Link href="/library">Go to Library</Link>
        </Button>
      </div>
    );
  }

  const renderContent = () => {
    switch (mode) {
      case 'flashcards':
        return <FlashcardView deck={activeDeck} isSrsMode={srs} onSessionEnd={() => setMode('menu')} />;
      case 'quiz':
        return <QuizView deck={activeDeck} onSessionEnd={() => setMode('menu')} />;
      case 'roleplay':
        return <RoleplayView deck={activeDeck} />;
      case 'glossary':
        return <GlossaryView deck={activeDeck} />;
      case 'reading':
        return <ReadingView deck={activeDeck} />;
      case 'menu':
      default:
        return <StudyMenu deck={activeDeck} onSelectMode={setMode} />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in">
      <div className="flex items-center justify-between mb-12 md:mb-16">
        <Button
          onClick={() => mode === 'menu' ? router.push('/library') : setMode('menu')}
          variant="ghost"
          className="flex items-center gap-3 font-black text-slate-400 hover:text-slate-900 transition-all text-lg group p-0 h-auto hover:bg-transparent"
        >
          <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" /> Back
        </Button>
        <h2 className="text-3xl font-black font-headline text-slate-800 text-center truncate max-w-lg px-4">
          {activeDeck.name}
        </h2>
        <div className="w-28 hidden md:block"></div>
      </div>
      {renderContent()}
    </div>
  );
}
