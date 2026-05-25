'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Target, CheckCircle2, Loader2, Heart, RefreshCw } from 'lucide-react';
import * as Tone from 'tone';
import type { Deck } from '@/lib/types';
import { generateQuizQuestionAction } from '@/app/actions';
import { useDecks } from '@/hooks/use-decks';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QuizViewProps {
  deck: Deck;
  onSessionEnd: () => void;
}

interface QuizQuestion {
  question: string;
  options: string[];
}

export default function QuizView({ deck, onSessionEnd }: QuizViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [quizQuestion, setQuizQuestion] = useState<QuizQuestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ correct: boolean; selected: number } | null>(null);
  const { addXp } = useDecks();
  const [lives, setLives] = useState(3);
  const [isGameOver, setIsGameOver] = useState(false);
  const [shake, setShake] = useState(false);
  
  const synths = useRef<{ correct: Tone.Synth | null; incorrect: Tone.Synth | null }>({ correct: null, incorrect: null });
  const audioStarted = useRef(false);
  
  useEffect(() => {
    try {
      synths.current.correct = new Tone.Synth().toDestination();
      synths.current.incorrect = new Tone.Synth().toDestination();
    } catch (e) {
      console.warn('[QuizView] Tone.js initialization failed:', e);
    }
    
    return () => {
      try {
        synths.current.correct?.dispose();
        synths.current.incorrect?.dispose();
      } catch (e) {
        console.warn('[QuizView] Tone.js dispose failed:', e);
      }
    };
  }, []);

  const currentCard = deck.cards[currentIndex];
  const correctOption = (currentCard?.back.split(' / ')[0] || currentCard?.back || '').trim();

  const fetchQuestion = useCallback(async (index: number) => {
    if (!deck.cards[index]) return;
    setLoading(true);
    setQuizQuestion(null);
    setFeedback(null);
    const card = deck.cards[index];
    const result = await generateQuizQuestionAction(card);
    if ('error' in result) {
      // Fallback to simple distractors
      const correctAnswer = (card.back.split(' / ')[0] || card.back).trim();
      const otherCards = deck.cards.filter((_, i) => i !== index);
      let distractors = otherCards.map(c => (c.back.split(' / ')[0] || c.back).trim()).sort(() => 0.5 - Math.random()).slice(0, 3);
      while (distractors.length < 3) distractors.push("Incorrect option");
      const options = [...distractors, correctAnswer].sort(() => 0.5 - Math.random());
      setQuizQuestion({ question: `What is the meaning of "${card.front}"?`, options });

    } else {
      setQuizQuestion(result as QuizQuestion);
    }
    setLoading(false);
  }, [deck.cards]);

  const startQuiz = useCallback(() => {
    setCurrentIndex(0);
    setLives(3);
    setIsGameOver(false);
    setFeedback(null);
    setLoading(true);
    fetchQuestion(0);
  }, [fetchQuestion]);

  useEffect(() => {
    if (!isGameOver) {
      fetchQuestion(currentIndex);
    }
  }, [currentIndex, fetchQuestion, isGameOver]);

  const handleAnswer = async (index: number) => {
    if (feedback || !quizQuestion) return;

    if (!audioStarted.current) {
        await Tone.start();
        audioStarted.current = true;
    }

    const selectedOption = quizQuestion.options[index];
    const isCorrect = selectedOption.trim() === correctOption;
    
    setFeedback({ correct: isCorrect, selected: index });
    const now = Tone.now();
    if (isCorrect) {
      if (synths.current.correct) {
        synths.current.correct.triggerAttackRelease('C5', '8n', now);
        synths.current.correct.triggerAttackRelease('E5', '8n', now + 0.1);
        synths.current.correct.triggerAttackRelease('G5', '8n', now + 0.2);
      }
      addXp(10);
    } else {
      if (synths.current.incorrect) {
        synths.current.incorrect.triggerAttackRelease('G3', '8n', now);
        synths.current.incorrect.triggerAttackRelease('E3', '8n', now + 0.12);
        synths.current.incorrect.triggerAttackRelease('C3', '8n', now + 0.24);
      }
      setShake(true);
      setTimeout(() => setShake(false), 400);
      const newLives = lives - 1;
      setLives(newLives);
      if (newLives <= 0) {
        setTimeout(() => setIsGameOver(true), 1500);
        return;
      }
    }

    setTimeout(() => {
      if (currentIndex < deck.cards.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setIsGameOver(true);
      }
    }, 1500);
  };

  if (isGameOver) {
    return (
      <div className="max-w-2xl mx-auto text-center space-y-8 animate-in fade-in">
        <h2 className="text-6xl font-black font-headline text-rose-500">{lives > 0 ? '🎉 Quiz Complete! 🎉' : 'Oops, out of lives!'}</h2>
        <p className="text-xl text-slate-500 font-medium max-w-md mx-auto">
            {lives > 0 ? `You mastered this session. Great job!` : `Don't worry, every mistake is a learning opportunity. Keep practicing!`}
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
            <Button onClick={startQuiz} size="lg" className="bg-indigo-600 text-white rounded-2xl text-lg font-bold py-6 px-8 flex items-center gap-3">
                <RefreshCw size={20} /> Try Again
            </Button>
            <Button onClick={onSessionEnd} size="lg" variant="outline" className="rounded-2xl text-lg font-bold py-6 px-8 border-2">
                Back to Lab
            </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-2xl mx-auto space-y-12 animate-in slide-in-from-bottom-12 duration-500">
      <div className="space-y-8">
        <div className="flex justify-between items-center">
            <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-6 py-2 rounded-full text-xs font-black uppercase tracking-tighter border border-emerald-100">
              <Target size={14} /> Master Selection
            </div>
            <div className={`flex items-center gap-3 ${shake ? 'animate-shake' : ''}`}>
                {Array.from({ length: 3 }).map((_, i) => (
                    <Heart key={i} size={24} className={cn('transition-all duration-300', i < lives ? 'text-rose-500 fill-current' : 'text-slate-300')} />
                ))}
            </div>
        </div>

        <div className="w-full px-4 space-y-2">
            <div className="flex justify-between items-center text-sm font-bold text-slate-500">
                <span className="uppercase tracking-wider">Progreso</span>
                <span>{currentIndex + 1} / {deck.cards.length}</span>
            </div>
            <Progress value={((currentIndex + 1) / deck.cards.length) * 100} className="h-3 bg-slate-200 [&>div]:bg-emerald-500" />
            <p className="text-center text-xs text-slate-400 font-medium pt-1">
                Faltan {deck.cards.length - (currentIndex + 1)}
            </p>
        </div>
        
        <div className="flex flex-col items-center gap-6 min-h-[144px] text-center">
          {loading ? (
             <Loader2 size={40} className="animate-spin text-slate-300" />
          ) : (
            <h2 className="text-5xl md:text-6xl font-black text-slate-800 tracking-tightest leading-none font-headline">
              {quizQuestion?.question ? (
                quizQuestion.question.split(/(".*?")/g).map((part, i) =>
                  part.startsWith('"') && part.endsWith('"') ? (
                    <span key={i} className="text-indigo-600 mx-2">
                      {part}
                    </span>
                  ) : (
                    part
                  )
                )
              ) : null}
            </h2>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 min-h-[400px]">
        {loading ? (
          <div className="flex justify-center items-center"><Loader2 className="animate-spin text-slate-400" /></div>
        ) : quizQuestion?.options.map((option, idx) => {
          const isFeedbackActive = feedback !== null;
          let buttonClass = 'bg-white border-slate-100 hover:border-indigo-500 hover:shadow-lg';
          if (isFeedbackActive) {
            if (option.trim() === correctOption) {
              buttonClass = 'bg-emerald-50 border-emerald-500 text-emerald-700 scale-[1.03]';
            } else if (feedback.selected === idx) {
              buttonClass = 'bg-rose-50 border-rose-500 text-rose-700';
            } else {
              buttonClass = 'bg-white border-slate-50 opacity-40 scale-95';
            }
          }
          return (
            <button
              key={`${currentIndex}-${idx}-${option}`}
              onClick={() => handleAnswer(idx)}
              disabled={isFeedbackActive}
              className={`w-full p-8 rounded-[2rem] text-left font-bold text-xl border-4 transition-all duration-300 ${buttonClass}`}
            >
              <div className="flex items-center justify-between">
                <span>{option}</span>
                {isFeedbackActive && option.trim() === correctOption && <CheckCircle2 className="text-emerald-500" size={28} />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
