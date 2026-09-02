'use client';

import { useState } from 'react';
import { Lightbulb, Loader2, Send, CheckCircle2, Info } from 'lucide-react';

import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { createModelConnectionClient } from '@/lib/model-connection-client';
import { cn } from '@/lib/utils';

interface PhraseExplorerProps {
  chunk: string;
}

type Feedback = {
  isCorrect: boolean;
  feedback: string;
  annotatedSentence: string;
};

export default function PhraseExplorer({ chunk }: PhraseExplorerProps) {
  const [userSentence, setUserSentence] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCheck = async () => {
    if (!userSentence.trim()) return;
    setIsLoading(true);
    setFeedback(null);
    try {
      const client = createModelConnectionClient();
      const result = await client.explorePhrase({ chunk, userSentence });
      setFeedback(result as Feedback);
    } catch (error) {
      console.error(error);
    }
    setIsLoading(false);
  };

  return (
    <div className="bg-white/50 mt-8 p-6 md:p-8 rounded-[3rem] border-2 border-dashed border-slate-200 animate-in fade-in-50">
      <div className="flex items-center gap-4 mb-4">
        <div className="bg-amber-100 text-amber-600 p-3 rounded-2xl"><Lightbulb size={24} /></div>
        <h3 className="text-2xl font-black font-headline text-slate-700">Phrase Explorer</h3>
      </div>
      <p className="text-slate-500 font-medium mb-6 ml-1">Try using the chunk <strong className="text-indigo-600">"{chunk}"</strong> in your own sentence below.</p>
      
      <div className="relative">
        <Textarea
          value={userSentence}
          onChange={(e) => setUserSentence(e.target.value)}
          placeholder="e.g., The story went beyond just reading..."
          className="bg-white rounded-[1.5rem] shadow-inner p-6 pr-20 min-h-[80px] resize-none"
          disabled={isLoading}
        />
        <Button
          size="icon"
          onClick={handleCheck}
          disabled={isLoading || !userSentence.trim()}
          className="absolute right-3 top-1/2 -translate-y-1/2 bg-indigo-600 text-white rounded-xl w-14 h-14 hover:bg-indigo-700 shadow-lg disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </div>

      {feedback && (
        <div className={cn("mt-6 p-6 rounded-3xl animate-in fade-in-50", feedback.isCorrect ? 'bg-emerald-50 border-2 border-emerald-200' : 'bg-blue-50 border-2 border-blue-200')}>
          <div className="flex items-start gap-4">
            {feedback.isCorrect 
              ? <CheckCircle2 className="text-emerald-500 h-8 w-8 shrink-0 mt-1" />
              : <Info className="text-blue-500 h-8 w-8 shrink-0 mt-1" />
            }
            <div>
              <p className={cn("text-lg font-bold mb-2", feedback.isCorrect ? 'text-emerald-800' : 'text-blue-800')}>
                {feedback.feedback}
              </p>
              {!feedback.isCorrect && (
                <div className="bg-white/60 p-4 rounded-xl">
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">Correct Version:</p>
                  <p className="font-bold text-slate-700 text-base">
                    {feedback.annotatedSentence.split(/(\*\*.*?\*\*)/g).map((part, i) => {
                      if (part.startsWith('**') && part.endsWith('**')) {
                        return (
                          <span key={i} className="bg-emerald-100 text-emerald-800 px-1 py-0.5 rounded-md shadow-inner ring-1 ring-emerald-200">
                            {part.slice(2, -2)}
                          </span>
                        );
                      }
                      return part;
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
