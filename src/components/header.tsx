'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Zap, FileUp, Star, Settings } from 'lucide-react';
import { useDecks } from '@/hooks/use-decks';
import { useToast } from '@/hooks/use-toast';
import { useSettingsModal } from '@/components/settings-modal';
import { cn } from '@/lib/utils';
import type { Card, Deck } from '@/lib/types';
import { Progress } from '@/components/ui/progress';

export function Header() {
  const pathname = usePathname();
  const importInputRef = useRef<HTMLInputElement>(null);
  const { importDecks, userProfile, xpToNextLevel, isLoaded } = useDecks();
  const { toast } = useToast();
  const { open: openSettings } = useSettingsModal();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        if (!file.name.endsWith('.json')) {
          throw new Error('Unsupported file type. Please import a .json file.');
        }

        const importedDeck = JSON.parse(content) as Deck;
        
        // Basic validation
        if (!importedDeck.id || !importedDeck.name || !Array.isArray(importedDeck.cards)) {
            throw new Error('Invalid deck JSON file.');
        }
        
        // Ensure all cards have SRS data, adding defaults if missing
        const sanitizedCards = importedDeck.cards.map(card => ({
          ...card,
          srs: card.srs || { interval: 0, repetition: 0, ef: 2.5, nextReview: Date.now(), status: 'new' }
        }));
        
        const deckToImport = { ...importedDeck, cards: sanitizedCards };

        importDecks([deckToImport]);
        toast({
            title: 'Success!',
            description: `Deck "${deckToImport.name}" imported successfully.`,
            variant: 'default',
        });

      } catch (err) {
        toast({
          title: 'Import Error',
          description: err instanceof Error ? err.message : 'Failed to read or parse the file.',
          variant: 'destructive',
        });
      }
      if (e.target) e.target.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <header className="bg-white/70 backdrop-blur-xl border-b border-white sticky top-0 z-50 px-6 py-4 flex justify-between items-center shadow-sm">
      <Link href="/library" className="flex items-center gap-3">
        <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg">
          <Zap size={24} />
        </div>
        <h1 className="text-xl font-black font-headline">
          GENKI<span className="text-indigo-600">.</span>
        </h1>
      </Link>
      <div className="flex items-center gap-6">
        {isLoaded && (
            <div className="flex items-center gap-3">
                <div className="bg-amber-400 text-white p-2 rounded-xl shadow-lg shadow-amber-500/20">
                    <Star size={20} className="fill-white"/>
                </div>
                <div>
                    <span className="font-black text-sm text-slate-700 leading-none">LEVEL {userProfile.level}</span>
                    <Progress value={(userProfile.xp / xpToNextLevel) * 100} className="w-24 h-1.5 mt-1 bg-slate-200 [&>div]:bg-amber-400" />
                    <span className="text-[10px] font-bold text-slate-400">{userProfile.xp}/{xpToNextLevel} XP</span>
                </div>
            </div>
        )}
        <div className="flex bg-slate-200/50 p-1 rounded-2xl">
          <Link
            href="/library"
            className={cn(
              'px-5 py-2 rounded-xl text-sm font-bold',
              pathname === '/library'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500'
            )}
          >
            Library
          </Link>
          <Link
            href="/creator"
            className={cn(
              'px-5 py-2 rounded-xl text-sm font-bold',
              pathname === '/creator'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500'
            )}
          >
            Create
          </Link>
          <button
            onClick={openSettings}
            className="px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 text-slate-500 hover:text-slate-700"
          >
            <Settings size={16} />
          </button>
        </div>
        <button
          onClick={() => importInputRef.current?.click()}
          className="text-slate-600 font-bold text-sm flex items-center gap-2"
        >
          <FileUp size={18} /> Import
        </button>
        <input
          type="file"
          ref={importInputRef}
          onChange={handleFileUpload}
          className="hidden"
          accept=".json"
        />
      </div>
    </header>
  );
}
