'use client';

import Link from 'next/link';
import { BookOpen, Download, Trash2, Target, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Deck } from '@/lib/types';
import { getDueCount } from '@/lib/srs';
import { useDecks } from '@/hooks/use-decks';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DeckCardProps {
  deck: Deck;
}

export function DeckCard({ deck }: DeckCardProps) {
  const { deleteDeck } = useDecks();
  const { toast } = useToast();
  const dueCount = getDueCount(deck);

  const handleExport = () => {
    const content = JSON.stringify(deck, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${deck.name}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Exported!', description: `Deck "${deck.name}" has been saved.` });
  };
  
  const handleConfirmDelete = () => {
    deleteDeck(deck.id)
    toast({ title: 'Deleted', description: `Deck "${deck.name}" has been removed.`, variant: 'destructive' });
  }

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all relative group flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <div className="relative">
          <div className="bg-indigo-50 text-indigo-600 p-4 rounded-2xl shadow-sm">
            <BookOpen size={28} />
          </div>
          {dueCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-xs font-black px-2 py-1 rounded-full shadow-lg border-2 border-white flex items-center gap-1">
              <Target size={12}/> {dueCount}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-indigo-600" onClick={handleExport}>
            <Download size={20} />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-rose-500">
                <Trash2 size={20} />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the deck "{deck.name}".
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <div className="flex-grow">
        <h3 className="text-2xl md:text-3xl font-black font-headline mb-1 truncate">{deck.name}</h3>
        <div className="flex items-center gap-4 text-slate-400 font-black text-xs uppercase mb-8 tracking-widest">
            <span>{deck.cards.length} Cards</span>
            <span className="text-slate-200">•</span>
            <span>{deck.createdAt}</span>
            {deck.cefrLevel && (
                <>
                <span className="text-slate-200">•</span>
                <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md border border-emerald-100">
                    <BarChart3 size={12} />
                    {deck.cefrLevel}
                </div>
                </>
            )}
        </div>
      </div>
      <Button asChild className="w-full bg-slate-900 text-white py-6 rounded-xl font-bold shadow-lg hover:bg-indigo-600 transition-all text-base">
        <Link href={`/study/${deck.id}`}>Open Lab</Link>
      </Button>
    </div>
  );
}
