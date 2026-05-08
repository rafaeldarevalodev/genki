
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ImageIcon,
  Loader2,
  Sparkles,
  X,
  Type,
  Target,
} from 'lucide-react';

import { useDecks } from '@/hooks/use-decks';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { generateCardsAction } from '@/app/actions';
import type { Deck } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

type Mode = 'words' | 'chunks';

const modeOptions = [
  {
    value: 'words' as Mode,
    icon: '📝',
    title: 'PALABRAS',
    description: 'Vocabulario individual para memorización',
  },
  {
    value: 'chunks' as Mode,
    icon: '🎯',
    title: 'CHUNKS',
    description: 'Frases y expresiones usadas en contexto real',
  },
] as const;

export default function CreatorPage() {
  const router = useRouter();
  const { addDeck, isLoaded } = useDecks();
  const { toast } = useToast();

  const [deckName, setDeckName] = useState('');
  const [textInput, setTextInput] = useState('');
  const [pastedImages, setPastedImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMounting, setIsMounting] = useState(true);
  const [mode, setMode] = useState<Mode>('chunks');
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
        title: 'Falta información',
        description: 'Por favor proporciona un nombre y contenido (texto o imágenes).',
        variant: 'destructive'
      });
      return;
    }
    setIsLoading(true);
    const result = await generateCardsAction(deckName, textInput, pastedImages, mode);

    if ('error' in result) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
      setIsLoading(false);
    } else {
      const newDeck = result as Deck;
      addDeck(newDeck);
      toast({ title: '¡Éxito!', description: `Se generaron ${newDeck.cards.length} tarjetas.` });
      router.push(`/creator/analysis/${newDeck.id}`);
    }
  };

  const buttonText = mode === 'words' ? 'Generar Deck de Palabras' : 'Generar Deck de Chunks';

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
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Nombre del Deck</label>
              <Input value={deckName} onChange={(e) => setDeckName(e.target.value)} placeholder="ej., Análisis de Historia..." className="p-6 bg-slate-50 rounded-[1.5rem] font-bold text-xl shadow-inner focus:ring-2 focus:ring-indigo-500 h-auto" />
            </div>
            
            {/* Mode Selector */}
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Modo de generación</label>
              <div className="grid grid-cols-2 gap-4">
                {modeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setMode(option.value)}
                    className={`
                      relative p-4 rounded-2xl border-2 transition-all duration-200 text-left
                      ${mode === option.value
                        ? 'border-indigo-500 bg-indigo-50 shadow-lg'
                        : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{option.icon}</span>
                      <span className={`font-black text-sm uppercase tracking-wider ${mode === option.value ? 'text-indigo-700' : 'text-slate-600'}`}>
                        {option.title}
                      </span>
                      {mode === option.value && (
                        <div className="absolute top-3 right-3 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full" />
                        </div>
                      )}
                    </div>
                    <p className={`text-xs ${mode === option.value ? 'text-indigo-600' : 'text-slate-400'}`}>
                      {option.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Texto o Contenido de Imagen</label>
              <Textarea value={textInput} onChange={(e) => setTextInput(e.target.value)} onPaste={handlePaste} placeholder="Pega texto o imágenes (Ctrl+V) aquí..." className="h-64 md:h-48 p-6 bg-slate-50 rounded-[1.5rem] text-lg resize-none shadow-inner" />
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
              {isLoading ? 'Analizando...' : buttonText}
            </Button>
            {!isLoaded && <p className="text-center text-xs font-bold text-slate-400 animate-pulse italic">Synchronizing library...</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
