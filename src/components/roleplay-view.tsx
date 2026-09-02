'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, LineChart, Trophy, Volume2, Loader2, CheckCircle2, Mic } from 'lucide-react';
import { getTTSAudio } from '@/app/actions';
import { createModelConnectionClient } from '@/lib/model-connection-client';
import { useSettings } from '@/hooks/use-settings';
import { useDecks } from '@/hooks/use-decks';
import { useToast } from '@/hooks/use-toast';
import { getCachedAudio, setCachedAudio } from '@/utils/audio-cache';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import FormattedText from '@/components/formatted-text';
import AudioPlayer from '@/components/audio-player';
import LiveVoiceUI from '@/components/roleplay/live-voice-ui';
import type { Deck } from '@/lib/types';

interface RoleplayViewProps {
  deck: Deck;
}

type ChatMessage = { role: 'user' | 'assistant'; text: string };
type Evaluation = { score: number; feedback: string; tips: string[] };
type RoleplayMode = 'chat' | 'voice';

export default function RoleplayView({ deck }: RoleplayViewProps) {
  const { settings, isLoaded: settingsLoaded } = useSettings();
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [userMsg, setUserMsg] = useState('');
  const [roleplayContext, setRoleplayContext] = useState<string | null>(null);
  const [aiEvaluation, setAiEvaluation] = useState<Evaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [audioLoading, setAudioLoading] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<RoleplayMode>('chat');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const { addXp } = useDecks();
  const { toast } = useToast();

  useEffect(() => {
    const initRoleplay = async () => {
      setLoading(true);
      try {
        const client = createModelConnectionClient();
        const vocabulary = deck.cards.map(c => c.front);
        const context = `The user wants to practice the following vocabulary in a conversation: ${vocabulary.join(', ')}. Create a simple, friendly scenario where they can use these words and start with the first message.`;
        const result = await client.startRoleplay({ vocabulary, scenarioContext: context });
        setRoleplayContext(context);
        setChatHistory([{ role: 'assistant', text: result.aiResponse }]);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        toast({
          title: 'Failed to start roleplay',
          description: message,
          variant: 'destructive',
        });
      }
      setLoading(false);
    };
    initRoleplay();
  }, [deck.cards, toast]);
  
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, loading]);

  const handleSendMsg = async () => {
    if (!userMsg.trim() || loading || !roleplayContext) return;
    const newHistory = [...chatHistory, { role: 'user' as 'user', text: userMsg }];
    setChatHistory(newHistory);
    setUserMsg('');
    setLoading(true);

    try {
      const client = createModelConnectionClient();
      const vocabulary = deck.cards.map(c => c.front);
      const result = await client.continueRoleplay({
        vocabulary,
        scenarioContext: roleplayContext,
        chatHistory: newHistory,
        userMessage: userMsg,
      });
      setChatHistory([...newHistory, { role: 'assistant', text: result.aiResponse }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast({
        title: 'AI Error',
        description: message,
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  const handleEvaluation = async () => {
    if (chatHistory.filter(m => m.role === 'user').length < 2 || !roleplayContext) return;
    setLoading(true);
    try {
      const client = createModelConnectionClient();
      const userInput = chatHistory.filter(m => m.role === 'user').map(m => m.text).join('\n');
      const result = await client.evaluateRoleplay({
        userInput,
        scenarioContext: roleplayContext,
      });
      setAiEvaluation(result);
      addXp(Math.round(result.score / 5)); // Grant XP based on score
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast({
        title: 'Evaluation Error',
        description: message,
        variant: 'destructive',
      });
    }
    setLoading(false);
  };
  
    // Helper to extract text without [tip] for TTS
    const extractTextForTTS = (text: string): string => {
      // Remove [tip] content for audio (tips are visual only)
      const tipMatch = text.match(/\[tip\][\s\S]*?$/i);
      if (tipMatch) {
        return text.slice(0, tipMatch.index).trim();
      }
      return text;
    };

    const handleTTSAction = async (text: string, id: string) => {
        if (!text || audioLoading || !settingsLoaded || !settings) return;
        
        // If clicking same audio, toggle play/pause
        if (playingAudio === id && audioUrl) {
            setPlayingAudio(null);
            setAudioUrl(null);
            return;
        }
        
        // Extract text without [tip] for TTS
        console.log('[roleplay-view] BEFORE extractTextForTTS - text:', text);
        const textForTTS = extractTextForTTS(text);
        console.log('[roleplay-view] AFTER extractTextForTTS - textForTTS:', textForTTS);
        
        setAudioLoading(id);
        
        // Get TTS config from settings
        const provider = settings.ttsProvider;
        const voice = provider === 'kokoro'
          ? settings.kokoroVoice
          : settings.f5ttsVoice;

        // Check cache first (only for short texts)
        console.log('[roleplay-view] Calling getTTSAudio with:', { textForTTS, voice, provider });
        
        let audioDataUrl = getCachedAudio(textForTTS, provider, voice);

        if (!audioDataUrl) {
            const fetchedAudioData = await getTTSAudio(textForTTS, voice, provider);
            if (fetchedAudioData && fetchedAudioData.media) {
                audioDataUrl = fetchedAudioData.media;
                setCachedAudio(textForTTS, provider, voice, audioDataUrl);
            }
        }

        if (audioDataUrl) {
            setAudioUrl(audioDataUrl);
            setPlayingAudio(id);
        }
        setAudioLoading(null);
    };

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6 animate-in zoom-in-95 duration-500">
      <div className="h-[650px] bg-white rounded-[4rem] border border-slate-50 shadow-2xl flex flex-col overflow-hidden relative min-h-0">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-violet-50/40 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="bg-violet-600 p-3 rounded-2xl text-white shadow-lg"><MessageSquare size={24}/></div>
            <div className="flex flex-col">
              <h4 className="font-black font-headline text-slate-800 text-lg">AI Roleplay Lab</h4>
              <div className="flex gap-1 mt-1">
                <button
                  onClick={() => setMode('chat')}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                    mode === 'chat' ? 'bg-violet-200 text-violet-700' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Chat
                </button>
                <button
                  onClick={() => setMode('voice')}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
                    mode === 'voice' ? 'bg-indigo-200 text-indigo-700' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Mic size={12} /> Voice
                </button>
              </div>
            </div>
          </div>
          <Button onClick={handleEvaluation} disabled={chatHistory.filter(m => m.role === 'user').length < 2 || loading || mode === 'voice'} className="flex items-center gap-2 bg-white text-indigo-600 px-5 py-2.5 rounded-2xl font-black shadow-sm border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all disabled:opacity-30 active:scale-95">
            <LineChart size={18} /> ✨ Evaluation
          </Button>
        </div>
        {mode === 'voice' ? (
          <LiveVoiceUI 
            vocabulary={deck.cards.map(c => c.front)}
            onExit={() => setMode('chat')}
          />
        ) : (
          <>
          <div ref={chatContainerRef} className="flex-1 min-h-0 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar bg-gradient-to-b from-white to-slate-50/20">
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-4 duration-300`}>
                <div className="flex flex-col gap-2 max-w-[95%] md:max-w-[90%] group">
                  <div className={`p-5 md:p-6 rounded-[2rem] font-medium text-base md:text-lg shadow-sm leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-100' : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'}`}>
                    {msg.role === 'assistant' ? <FormattedText text={msg.text} /> : msg.text}
                  </div>
                  {msg.role === 'assistant' && (
                    <>
                      <button onClick={() => handleTTSAction(msg.text, `msg-${i}`)} className="flex items-center gap-2 text-[10px] font-black text-slate-300 hover:text-indigo-500 transition-colors uppercase tracking-widest ml-4">
                        {audioLoading === `msg-${i}` ? <Loader2 size={12} className="animate-spin" /> : <Volume2 size={12} />} 
                        {playingAudio === `msg-${i}` ? 'Playing' : 'Listen'}
                      </button>
                      {playingAudio === `msg-${i}` && audioUrl && (
                        <AudioPlayer audioUrl={audioUrl} onClose={() => { setPlayingAudio(null); setAudioUrl(null); }} />
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
            {loading && !aiEvaluation && <div className="flex items-center gap-3 animate-pulse text-slate-300 font-bold italic p-4 ml-4"><Loader2 size={18} className="animate-spin" /> AI is speaking...</div>}
          </div>
          <div className="p-6 md:p-10 bg-white border-t border-slate-50">
            <div className="relative group">
              <Input disabled={loading} value={userMsg} onChange={(e) => setUserMsg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMsg()} placeholder="Type in English..." className="w-full p-6 pr-20 bg-slate-50 rounded-[1.8rem] border-none focus:ring-2 focus:ring-violet-500 outline-none font-bold text-lg shadow-inner h-auto" />
              <Button disabled={loading || !userMsg.trim()} onClick={handleSendMsg} size="icon" className="absolute right-2.5 top-2.5 bg-violet-600 text-white p-3.5 rounded-[1.2rem] hover:bg-violet-700 shadow-xl shadow-violet-100 active:scale-90 transition-all duration-300 h-11 w-11">
                  <Send size={20} />
              </Button>
            </div>
          </div>
          </>
        )}
      </div>
      {aiEvaluation && (
        <div className="bg-indigo-900 text-white p-10 rounded-[4rem] shadow-2xl animate-in slide-in-from-bottom-10 space-y-8">
          <div className="flex items-center justify-between border-b border-white/10 pb-8">
            <h3 className="text-3xl font-black font-headline flex items-center gap-3"><Trophy className="text-amber-400" /> ✨ Lab Evaluation</h3>
            <div className="bg-white text-indigo-900 w-24 h-24 rounded-full flex flex-col items-center justify-center border-8 border-indigo-400 shadow-xl"><span className="text-3xl font-black leading-none">{aiEvaluation.score}</span><span className="text-[10px] font-black uppercase opacity-60">Points</span></div>
          </div>
          <p className="text-indigo-100 text-xl md:text-2xl font-medium leading-relaxed italic">"{aiEvaluation.feedback}"</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{aiEvaluation.tips.map((tip, i) => (<div key={i} className="bg-white/5 p-6 rounded-3xl border border-white/10 flex items-start gap-4 hover:bg-white/10 transition-all"><CheckCircle2 className="text-emerald-400 shrink-0 mt-1" size={20} /><span className="font-medium text-sm leading-relaxed">{tip}</span></div>))}</div>
          <Button onClick={() => setAiEvaluation(null)} className="w-full bg-white text-indigo-900 py-6 rounded-3xl font-black text-xl hover:bg-indigo-50 shadow-2xl transition-all active:scale-[0.98] h-auto">Continue Training</Button>
        </div>
      )}
    </div>
  );
}
