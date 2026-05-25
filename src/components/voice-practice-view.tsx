'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Volume2, CheckCircle2, XCircle, Loader2, Lock, Unlock, ArrowRight, RotateCcw, Trophy } from 'lucide-react';
import type { Deck, Card } from '@/lib/types';
import { getDueCount } from '@/lib/srs';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSettings } from '@/hooks/use-settings';
import AudioPlayer from './audio-player';

interface VoicePracticeViewProps {
  deck: Deck;
  onSessionEnd: () => void;
}

interface RouteProgress {
  id: number;
  name: string;
  cards: Card[];
  completed: number;
  locked: boolean;
  unlockedAt?: number;
}

interface PhonemeDetail {
  phoneme: string;
  start: number;
  end: number;
  confidence: number;
  status: 'correct' | 'warning' | 'error';
}

interface PracticeResult {
  card: Card;
  score: number;
  feedback: string;
  transcribedText: string;
  phonemeDetails?: PhonemeDetail[];
}

// Voice practice routes configuration
const ROUTES: { id: number; name: string; level: string }[] = [
  { id: 1, name: 'Ruta 1: Básico', level: 'basic' },
  { id: 2, name: 'Ruta 2: Intermedio', level: 'intermediate' },
  { id: 3, name: 'Ruta 3: Avanzado', level: 'advanced' },
];

const CARDS_PER_ROUTE = 10;

export default function VoicePracticeView({ deck, onSessionEnd }: VoicePracticeViewProps) {
  const { settings, isLoaded: settingsLoaded } = useSettings();
  const [currentRoute, setCurrentRoute] = useState<number>(1);
  const [routeProgress, setRouteProgress] = useState<RouteProgress[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [referenceAudioUrl, setReferenceAudioUrl] = useState<string | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [playingRecorded, setPlayingRecorded] = useState(false);
  const [isLoadingReference, setIsLoadingReference] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [result, setResult] = useState<PracticeResult | null>(null);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioPlaybackRef = useRef<HTMLAudioElement | null>(null);
  const currentCardTextRef = useRef<string>('');
  const currentRequestRef = useRef<number>(0);

  const referenceAudioUrlRef = useRef<string | null>(null);
  const recordedAudioUrlRef = useRef<string | null>(null);

  // Update ref when card changes
  useEffect(() => {
    if (currentCard?.front) {
      currentCardTextRef.current = currentCard.front;
    }
  }, [currentCard]);

  // Cleanup blob URLs to prevent memory leaks
  useEffect(() => {
    referenceAudioUrlRef.current = referenceAudioUrl;
    recordedAudioUrlRef.current = recordedAudioUrl;
    
    return () => {
      if (referenceAudioUrlRef.current) {
        URL.revokeObjectURL(referenceAudioUrlRef.current);
      }
      if (recordedAudioUrlRef.current) {
        URL.revokeObjectURL(recordedAudioUrlRef.current);
      }
      // Just clear the ref, don't call pause() during cleanup
      audioElementRef.current = null;
      audioPlaybackRef.current = null;
    };
  }, [referenceAudioUrl, recordedAudioUrl]);

  // Initialize routes with SRS order
  const initializeRoutes = useCallback(() => {
    console.log('[VoicePractice] Initializing with deck:', deck.name, 'cards:', deck.cards?.length);
    
    if (!deck.cards || deck.cards.length === 0) {
      setError('No cards in deck');
      return;
    }

    // Sort cards by SRS (next review date) - oldest first
    const sortedCards = [...deck.cards].sort((a, b) => {
      const aTime = a.srs?.nextReview || 0;
      const bTime = b.srs?.nextReview || 0;
      return aTime - bTime;
    });

    console.log('[VoicePractice] sortedCards:', sortedCards.length);

    const routesData: RouteProgress[] = ROUTES.map((route, index) => {
      const startIdx = index * CARDS_PER_ROUTE;
      const routeCards = sortedCards.slice(startIdx, startIdx + CARDS_PER_ROUTE);
      
      return {
        id: route.id,
        name: route.name,
        cards: routeCards,
        completed: 0,
        locked: index > 0,
      };
    });

    setRouteProgress(routesData);
    if (sortedCards.length > 0) {
      setCurrentCard(sortedCards[0]);
    }
  }, [deck]);

  useEffect(() => {
    if (deck.cards?.length > 0) {
      initializeRoutes();
    }
  }, [initializeRoutes]);

  // Play reference audio
  const playReference = useCallback(async () => {
    if (!currentCard) {
      return;
    }
    
    // Si settings no loaded, usar valores por defecto en lugar de mostrar error
    const provider = settings?.ttsProvider || 'piper';
    const playbackSpeed = settings?.playbackSpeed || 1;
    
    setIsLoadingReference(true);
    setError(null);
    
    // If there's a previous audio playing, stop it first
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
    }
    
    // Clean up previous URL
    if (referenceAudioUrl) {
      URL.revokeObjectURL(referenceAudioUrl);
      setReferenceAudioUrl(null);
    }
    
    // Get TTS config from settings (fallback values)
    const useKokoro = provider === 'kokoro';
    const useVibeVoice7B = provider === 'vibevoice7b';
    const useF5TTS = provider === 'f5tts';
    
    let apiUrl: string;
    let requestBody: Record<string, unknown>;
    
    if (useVibeVoice7B) {
      apiUrl = 'http://localhost:8091/v1/audio/speech';
      requestBody = {
        input: currentCard.front,
        voice: settings?.vibevoice7bVoice || 'en-Emma_woman',
      };
    } else if (useKokoro) {
      apiUrl = 'http://localhost:8880/v1/audio/speech';
      requestBody = {
        input: currentCard.front,
        voice: settings?.kokoroVoice || 'af_bella',
        speed: 1.0
      };
    } else if (useF5TTS) {
      apiUrl = 'http://localhost:8093/tts';
      requestBody = {
        text: currentCard.front,
        voice: settings?.f5ttsVoice || 'en-Giuseppe_man'
      };
    } else {
      apiUrl = 'http://localhost:8080/tts';
      requestBody = {
        text: currentCard.front,
        voice: settings?.voice || 'en_GB-alan-medium'
      };
    }
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`TTS failed: ${response.status} - ${errText}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setReferenceAudioUrl(url);
      
      const audio = new Audio(url);
      audioElementRef.current = audio;
      audio.playbackRate = settings.playbackSpeed || 1;
      
      audio.onended = () => {
        setIsLoadingReference(false);
      };
      
      audio.onerror = () => {
        setIsLoadingReference(false);
      };
      
      await audio.play();
    } catch (error) {
      console.error('[playReference] Error:', error);
      setError('Failed to play audio');
      setIsLoadingReference(false);
    }
  }, [currentCard, referenceAudioUrl]);

  // Record audio
  const startRecording = useCallback(async () => {
    console.log('[startRecording] Starting...');
    setError(null);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('[startRecording] Got stream');
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Create audio blob - use webm for recording
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Create URL for playback
        const audioUrl = URL.createObjectURL(blob);
        setRecordedAudioUrl(audioUrl);
        
        // Process recording with the URL
        try {
          await processRecording(blob, audioUrl);
        } catch (e) {
          console.error('[processRecording] error:', e);
        }
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.onerror = (e) => {
        console.error('[Recorder] error:', e);
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
    } catch (error) {
      console.error('[startRecording] Error:', error);
      setError('Failed to access microphone. Please allow microphone access.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

// Process recording with AI Coach
  const processRecording = useCallback(async (audioBlob: Blob, audioUrl?: string) => {
    const cardText = currentCardTextRef.current || currentCard?.front;
    if (!cardText) {
      return;
    }

    setIsRecording(false);
    setIsEvaluating(true);
    setError(null);
    
    // Use provided URL or create new one
    const url = audioUrl || URL.createObjectURL(audioBlob);
    setRecordedAudioUrl(url);
    
    try {
      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const audioBase64 = btoa(binary);

      // Call voice practice evaluation - send as JSON
      const response = await fetch('/api/voice-practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cardText,
          audio: audioBase64,
          language: 'en'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Evaluation failed: ${response.status}`);
      }

      const data = await response.json();
      
      const card = currentCard as Card;
      setResult({
        card,
        score: data.score,
        feedback: data.feedback_text,
        transcribedText: data.transcription,
        phonemeDetails: data.phoneme_details
      });
      
      setRecordedAudioUrl(url);

      // Update route progress
      if (data.score >= 70) {
        setRouteProgress(prev => prev.map(r => {
          if (r.id === currentRoute) {
            return { ...r, completed: r.completed + 1 };
          }
          return r;
        }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[processRecording] Error:', message);
      setError('Failed to evaluate. Please try again. Error: ' + message);
    } finally {
      setIsEvaluating(false);
    }
  }, [currentCard, currentRoute]);

  // Next card
  const nextCard = useCallback(() => {
    const route = routeProgress.find(r => r.id === currentRoute);
    if (!route) return;

    const nextIndex = currentCardIndex + 1;
    if (nextIndex < route.cards.length) {
      setCurrentCardIndex(nextIndex);
      setCurrentCard(route.cards[nextIndex]);
      setResult(null);
      setRecordedAudioUrl(null);
    } else {
      setSessionComplete(true);
    }
  }, [routeProgress, currentRoute, currentCardIndex]);

  // Retry current card
  const retryCard = useCallback(() => {
    setResult(null);
    setRecordedAudioUrl(null);
  }, []);

  // Get score message (0-100 scale)
  const getScoreMessage = (score: number): string => {
    if (score >= 90) return 'You sound like a native speaker! 🌟';
    if (score >= 75) return 'You sound almost like a native! 🎉';
    if (score >= 60) return 'Good pronunciation! Keep practicing 👍';
    if (score >= 40) return 'Moderately well. Almost there! 💪';
    return 'You need to improve. Keep practicing! 📚';
  };

  // Get what to improve
  const getImprovements = (score: number): string[] => {
    if (score >= 90) return [];
    if (score >= 75) return ['Focus on sentence rhythm', 'Try to sound more natural'];
    if (score >= 60) return ['Work on vowel sounds', 'Practice the word stress'];
    if (score >= 40) return ['Repeat slowly after the reference', 'Focus on clear pronunciation'];
    return ['Listen to the reference many times', 'Practice each sound separately', 'Try saying one syllable at a time'];
  };

  // Get score category
  const getScoreCategory = (score: number): string => {
    if (score >= 90) return 'Native';
    if (score >= 75) return 'Advanced';
    if (score >= 60) return 'Intermediate';
    if (score >= 40) return 'Beginner';
    return ' Starter';
  };

  // Get score color (0-100 scale)
  const getScoreColor = (score: number): string => {
    if (score <= 40) return 'text-red-500';
    if (score <= 60) return 'text-yellow-500';
    if (score <= 80) return 'text-green-500';
    return 'text-emerald-500';
  };

  // Unlock next route
  useEffect(() => {
    const route = routeProgress.find(r => r.id === currentRoute);
    if (route && route.completed >= CARDS_PER_ROUTE && currentRoute < 3) {
      setRouteProgress(prev => prev.map(r => {
        if (r.id === currentRoute + 1) {
          return { ...r, locked: false, unlockedAt: Date.now() };
        }
        return r;
      }));
    }
  }, [routeProgress, currentRoute]);

  // Render route selection
  if (sessionComplete) {
    return (
      <div className="text-center space-y-8 animate-in fade-in">
        <div className="bg-emerald-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto">
          <Trophy size={48} className="text-emerald-600" />
        </div>
        <div>
          <h3 className="text-3xl font-black text-slate-800">¡Ruta Completada!</h3>
          <p className="text-slate-500 mt-2">Has practicado 10 cards de esta ruta</p>
        </div>
        <div className="flex gap-4 justify-center">
          <Button onClick={onSessionEnd} variant="outline" className="rounded-full px-8">
            Volver al Menú
          </Button>
          <Button onClick={() => {
            setSessionComplete(false);
            setCurrentCardIndex(0);
            setRouteProgress(prev => prev.map(r => 
              r.id === currentRoute ? { ...r, completed: 0 } : r
            ));
          }} className="rounded-full px-8">
            <RotateCcw size={18} className="mr-2" />
            Repetir Ruta
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* Error display */}
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-center">
          {error}
        </div>
      )}

      {/* No cards */}
      {!currentCard && !error && (
        <div className="text-center text-slate-500 py-8">
          Loading...
        </div>
      )}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {routeProgress.map((route) => (
          <button
            key={route.id}
            onClick={() => !route.locked && setCurrentRoute(route.id)}
            disabled={route.locked}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-all',
              route.locked 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : currentRoute === route.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-200'
            )}
          >
            {route.locked ? <Lock size={14} /> : <Unlock size={14} />}
            {route.name}
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
              {route.completed}/{CARDS_PER_ROUTE}
            </span>
          </button>
        ))}
      </div>

      {/* Current Card */}
      {currentCard && (
        <div className="bg-white rounded-[3rem] shadow-lg p-8 space-y-6">
          {/* Progress */}
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>Card {currentCardIndex + 1} de {CARDS_PER_ROUTE}</span>
            <span>Ruta {currentRoute}</span>
          </div>

          {/* Word Display */}
          <div className="text-center space-y-4">
            <div className="text-sm text-slate-400 font-mono">
              IPA: {currentCard.ipa}
            </div>
            <div className="text-5xl font-black text-slate-800">
              {currentCard.front}
            </div>
            <div className="text-lg text-slate-500">
              {currentCard.back}
            </div>
          </div>

          {/* Audio Controls */}
          <div className="flex justify-center gap-4">
            <button
              onClick={playReference}
              disabled={isLoadingReference}
              className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center hover:bg-indigo-200 transition-all disabled:opacity-50"
              title="Play reference"
            >
              {isLoadingReference ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <Volume2 size={24} />
              )}
            </button>

            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isEvaluating}
              className={cn(
                'w-20 h-20 rounded-full flex items-center justify-center transition-all',
                isRecording 
                  ? 'bg-red-500 text-white animate-pulse' 
                  : 'bg-red-100 text-red-500 hover:bg-red-200',
                isEvaluating && 'opacity-50 cursor-not-allowed'
              )}
              title={isRecording ? "Stop recording" : "Start recording"}
            >
              {isEvaluating ? (
                <Loader2 size={28} className="animate-spin" />
              ) : isRecording ? (
                <XCircle size={28} />
              ) : (
                <Mic size={28} />
              )}
            </button>

            {/* Play recorded audio button */}
            {recordedAudioUrl && !isRecording && !result && (
              <div className="mt-4">
                <AudioPlayer 
                  audioUrl={recordedAudioUrl} 
                  onClose={() => setPlayingRecorded(false)}
                />
              </div>
            )}
          </div>

          {/* Result */}
          {result && result.score !== undefined && (
            <div className="space-y-6 animate-in fade-in">
              {/* Audio player for recording */}
              {recordedAudioUrl && (
                <div className="mt-4">
                  <AudioPlayer 
                    audioUrl={recordedAudioUrl} 
                    onClose={() => setPlayingRecorded(false)}
                  />
                </div>
              )}
              
              <div className={cn('text-center space-y-2', getScoreColor(result.score))}>
                <div className="text-6xl font-black">
                  {result.score}%
                </div>
                <div className="text-xl font-bold">
                  {getScoreCategory(result.score)} Level
                </div>
                <div className="text-lg">
                  {getScoreMessage(result.score)}
                </div>
              </div>
              
              {/* Phoneme feedback visualization */}
              {result.phonemeDetails && result.phonemeDetails.length > 0 && (
                <div className="bg-slate-100 rounded-xl p-4 space-y-3">
                  <div className="text-sm font-bold text-slate-600">🔍 Pronunciation Breakdown:</div>
                  <div className="flex flex-wrap gap-1 justify-center">
                    {result.phonemeDetails.map((phoneme, i) => (
                      <span
                        key={i}
                        className={cn(
                          'px-2 py-1 rounded text-sm font-medium',
                          phoneme.status === 'correct' && 'bg-green-100 text-green-700',
                          phoneme.status === 'warning' && 'bg-yellow-100 text-yellow-700',
                          phoneme.status === 'error' && 'bg-red-100 text-red-700'
                        )}
                        title={`Start: ${phoneme.start.toFixed(2)}s, End: ${phoneme.end.toFixed(2)}s, Confidence: ${Math.round(phoneme.confidence * 100)}%`}
                      >
                        {phoneme.phoneme}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-4 justify-center text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded bg-green-100 border border-green-300"></span> Correct
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300"></span> Warning
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded bg-red-100 border border-red-300"></span> Needs work
                    </span>
                  </div>
                </div>
              )}
              
              {/* What you said vs what you should say */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <div className="text-sm text-slate-500">You said:</div>
                <div className="text-lg font-medium text-slate-700">"{result.transcribedText || '...'}"</div>
                <div className="text-sm text-slate-500">Expected:</div>
                <div className="text-lg font-medium text-indigo-600">"{currentCard?.front}"</div>
              </div>
              
              {/* Feedback / Tips */}
              <div className="bg-blue-50 rounded-xl p-4 space-y-2">
                <div className="text-sm text-blue-600 font-bold">💡 Tips to improve:</div>
                <ul className="text-sm text-slate-600 space-y-1">
                  {getImprovements(result.score).map((tip, i) => (
                    <li key={i}>• {tip}</li>
                  ))}
                </ul>
              </div>
              
              {/* Overall feedback */}
              <div className="text-slate-600 text-center max-w-md mx-auto">
                {result.feedback}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 justify-center pt-4">
                {result.score < 70 ? (
                  <Button onClick={retryCard} className="rounded-full px-8">
                    <RotateCcw size={18} className="mr-2" />
                    Intentar de Nuevo
                  </Button>
                ) : (
                  <Button onClick={nextCard} className="rounded-full px-8">
                    Siguiente
                    <ArrowRight size={18} className="ml-2" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {!result && !isRecording && !isEvaluating && (
            <div className="text-center text-slate-400 text-sm">
              Presiona 🔊 para escuchar, luego 🎤 para grabar
            </div>
          )}
        </div>
      )}
    </div>
  );
}