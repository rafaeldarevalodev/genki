
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ImageIcon,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';

import { useDecks } from '@/hooks/use-decks';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { generateCardsAction } from '@/app/actions';
import type { Deck } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

export default function CreatorPage() {
  const router = useRouter();
  const { addDeck, isLoaded } = useDecks();
  const { toast } = useToast();

  const [deckName, setDeckName] = useState('');
  const [textInput, setTextInput] = useState('');
  const [pastedImages, setPastedImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMounting, setIsMounting] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMounting(false);
  }, []);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPastedImages((prev) => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
    if (e.target) e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.includes('image')) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            setPastedImages((prev) => [...prev, ev.target?.result as string]);
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };
  
  const handleGenerate = async () => {
    if (pastedImages.length === 0 && (!textInput.trim() || !deckName.trim())) {
      toast({
        title: 'Missing Information',
        description: 'Please provide a deck name and some content (text or images).',
        variant: 'destructive'
      });
      return;
    }
    setIsLoading(true);
    const result = await generateCardsAction(deckName, textInput, pastedImages);

    if ('error' in result) {
      toast({ title: 'Generation Failed', description: result.error, variant: 'destructive' });
      setIsLoading(false);
    } else {
      const newDeck = result as Deck;
      addDeck(newDeck);
      toast({ title: 'Success!', description: `Generated ${newDeck.cards.length} new cards.` });
      router.push(`/creator/analysis/${newDeck.id}`);
    }
  };

  if (isMounting) {
    return (
       <div className="max-w-5xl mx-auto space-y-10 animate-pulse">
        <div className="text-center space-y-4">
          <Skeleton className="h-16 w-64 mx-auto rounded-full" />
          <Skeleton className="h-6 w-48 mx-auto rounded-full" />
        </div>
        <div className="bg-white p-6 md:p-12 rounded-[3.5rem] shadow-2xl flex flex-col gap-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="space-y-6">
              <Skeleton className="h-80 w-full rounded-[1.5rem]" />
            </div>
            <div className="flex flex-col gap-6">
              <Skeleton className="flex-1 min-h-[300px] rounded-[2.5rem]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-in slide-in-from-bottom-8 duration-500">
      <div className="text-center space-y-2">
        <h2 className="text-5xl md:text-6xl font-black font-headline tracking-tighter italic">CHUNKING</h2>
        <p className="text-slate-400 text-lg md:text-xl font-medium tracking-tight">
          AI-powered learning blocks ✨
        </p>
      </div>
      <div className="bg-white p-6 md:p-12 rounded-[3.5rem] shadow-2xl flex flex-col gap-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Deck Name</label>
              <Input value={deckName} onChange={(e) => setDeckName(e.target.value)} placeholder="e.g., Story Analysis..." className="p-6 bg-slate-50 rounded-[1.5rem] font-bold text-xl shadow-inner focus:ring-2 focus:ring-indigo-500 h-auto" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Text or Image Content</label>
              <Textarea value={textInput} onChange={(e) => setTextInput(e.target.value)} onPaste={handlePaste} placeholder="Paste text or images (Ctrl+V) here..." className="h-64 md:h-80 p-6 bg-slate-50 rounded-[1.5rem] text-lg resize-none shadow-inner" />
            </div>
          </div>
          <div className="flex flex-col gap-6">
            <div className="flex-1 bg-slate-50 border-4 border-dashed border-slate-100 rounded-[2.5rem] p-6 flex flex-wrap gap-4 overflow-y-auto min-h-[300px] max-h-[450px] relative shadow-inner custom-scrollbar">
              {pastedImages.length === 0 ? (
                <div className="m-auto flex flex-col items-center gap-4 text-slate-300 opacity-50 text-center">
                  <ImageIcon size={64} /><p className="font-bold">Images will appear here</p>
                </div>
              ) : (
                pastedImages.map((img, i) => (
                  <div key={i} className="relative group/img animate-in zoom-in-90">
                    <img src={img} alt={`Pasted content ${i+1}`} className="w-24 h-24 object-cover rounded-2xl border-2 border-white shadow-lg" />
                    <Button onClick={() => setPastedImages(p => p.filter((_, idx) => idx !== i))} variant="destructive" size="icon" className="absolute -top-2 -right-2 h-7 w-7 rounded-full shadow-xl active:scale-90"><X size={14} strokeWidth={3} /></Button>
                  </div>
                ))
              )}
            </div>
             <Button onClick={handleGenerate} disabled={isLoading || !isLoaded} size="lg" className="w-full bg-indigo-600 text-white py-8 rounded-[2.5rem] font-black text-2xl flex items-center justify-center gap-4 hover:bg-indigo-700 disabled:opacity-40 shadow-xl transition-all active:scale-95 h-auto">
              {isLoading ? <Loader2 className="animate-spin" size={28} /> : <Sparkles size={28} />}
              {isLoading ? 'Analyzing...' : 'Generate Chunks Deck'}
            </Button>
            {!isLoaded && <p className="text-center text-xs font-bold text-slate-400 animate-pulse italic">Synchronizing library...</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
