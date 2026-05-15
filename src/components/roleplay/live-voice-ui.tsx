'use client';

import React from 'react';
import { Mic, MicOff, Volume2, MessageSquare, X, Loader2, Download } from 'lucide-react';
import { useLiveVoice, type LiveVoiceState } from '@/hooks/useLiveVoice';

interface LiveVoiceUIProps {
  deckId?: string;
  vocabulary?: string[];
  onExit?: () => void;
}

function MayaAvatar({ isSpeaking }: { isSpeaking: boolean }) {
  return (
    <div className="relative w-40 h-40 flex items-center justify-center">
      {/* Outer glow ring */}
      <div className={`absolute inset-0 rounded-full transition-all duration-700 ${
        isSpeaking 
          ? 'animate-pulse-slow scale-110 opacity-60' 
          : 'opacity-20 scale-100'
      }`}>
        <div className="w-full h-full rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-purple-600 blur-xl" />
      </div>

      {/* Animated blob */}
      <div className={`relative w-32 h-32 transition-all duration-500 ${
        isSpeaking ? 'animate-blob' : ''
      }`}>
        <div className={`absolute inset-0 rounded-full transition-all duration-300 ${
          isSpeaking 
            ? 'bg-gradient-to-br from-violet-500 via-indigo-500 to-purple-600 shadow-[0_0_60px_rgba(139,92,246,0.5)]' 
            : 'bg-gradient-to-br from-slate-300 to-slate-400 opacity-50'
        }`}>
          {/* Inner shine */}
          <div className={`absolute inset-2 rounded-full transition-all duration-300 ${
            isSpeaking ? 'bg-gradient-to-br from-white/30 to-transparent' : ''
          }`} />
        </div>

        {/* Orbiting particles when speaking */}
        {isSpeaking && (
          <>
            <div className="absolute inset-0 animate-spin-slow">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-white/80 rounded-full blur-sm" />
            </div>
            <div className="absolute inset-0 animate-spin-slow" style={{ animationDirection: 'reverse', animationDuration: '8s' }}>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-violet-300 rounded-full blur-sm" />
            </div>
          </>
        )}
      </div>

      {/* Label */}
      <span className={`absolute -bottom-2 text-lg font-bold transition-colors duration-300 ${
        isSpeaking ? 'text-indigo-600' : 'text-slate-400'
      }`}>
        MAYA
      </span>
    </div>
  );
}

function Waveform({ isActive }: { isActive: boolean }) {
  return (
    <div className="flex items-center justify-center gap-1 h-12">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className={`w-1 rounded-full transition-all duration-150 ${
            isActive 
              ? 'bg-indigo-500 animate-pulse' 
              : 'bg-slate-300'
          }`}
          style={{
            height: isActive 
              ? `${Math.random() * 100}%`
              : '20%',
            animationDelay: isActive ? `${i * 0.05}s` : '0s',
            minHeight: '8px',
            maxHeight: '48px'
          }}
        />
      ))}
    </div>
  );
}

function StatusIndicator({ state }: { state: LiveVoiceState['vadState'] }) {
  const statusConfig = {
    idle: { text: 'Toca para hablar', icon: Mic, color: 'text-slate-500' },
    listening: { text: 'Escuchando...', icon: Mic, color: 'text-red-500 animate-pulse' },
    speaking: { text: 'Maya habla...', icon: Volume2, color: 'text-indigo-500' },
    processing: { text: 'Procesando...', icon: Loader2, color: 'text-amber-500' }
  };

  const config = statusConfig[state];
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 ${config.color}`}>
      <Icon size={20} className={state === 'processing' ? 'animate-spin' : ''} />
      <span className="text-sm font-medium">{config.text}</span>
    </div>
  );
}

export default function LiveVoiceUI({ deckId, vocabulary = [], onExit }: LiveVoiceUIProps) {
  const {
    state,
    startListening,
    interrupt,
    toggleMode,
    isRecording
  } = useLiveVoice({
    vocabulary,
    onUserTranscript: (text) => console.log('[User]:', text),
    onMayaResponse: (text) => console.log('[Maya]:', text),
    onMayaSpeaking: (speaking) => console.log('[Maya speaking]:', speaking),
    onError: (error) => console.error('[Error]:', error)
  });

  // Debug: log audioDownloadUrl changes
  console.log('[LiveVoiceUI] state.audioDownloadUrl:', state.audioDownloadUrl);

  const handleMicPress = () => {
    if (state.vadState === 'listening') {
      interrupt();
    } else if (state.vadState === 'idle' || state.vadState === 'speaking') {
      startListening();
    }
  };

  return (
    <div className="h-full relative flex flex-col bg-gradient-to-b from-slate-50 to-white min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white/80 backdrop-blur-sm z-20">
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleMode('chat')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              state.mode === 'chat' 
                ? 'bg-slate-200 text-slate-700' 
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <MessageSquare size={16} className="inline mr-1" />
            Chat
          </button>
          <button
            onClick={() => toggleMode('voice')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              state.mode === 'voice' 
                ? 'bg-indigo-100 text-indigo-700' 
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <Mic size={16} className="inline mr-1" />
            Voice
          </button>
        </div>
        
        {onExit && (
          <button
            onClick={onExit}
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            <X size={20} className="text-slate-500" />
          </button>
        )}
      </div>

      {/* Avatar & Waveform layer (behind transcripts) */}
      <div className="absolute inset-x-0 top-16 flex flex-col items-center pt-8 pb-4 pointer-events-none">
        <MayaAvatar isSpeaking={state.isMayaSpeaking} />
        <h2 className="mt-4 text-xl font-bold text-slate-800">Maya</h2>
        <div className="mt-4 w-full max-w-xs">
          <Waveform isActive={state.vadState === 'speaking' || state.vadState === 'listening'} />
        </div>
        <div className="mt-4">
          <StatusIndicator state={state.vadState} />
        </div>
      </div>

      {/* Transcripts overlay - 50% height, scrollable */}
      <div className="absolute top-1/2 inset-x-0 bottom-24 overflow-y-auto custom-scrollbar bg-white/90 backdrop-blur-sm border-t border-slate-100 rounded-t-3xl">
        <div className="max-w-md mx-auto space-y-4 p-6">
          {state.messages.length === 0 && !state.userTranscript && !state.mayaTranscript && (
            <p className="text-center text-slate-400 text-sm py-8">
              Mantén presionado el micrófono para hablar
            </p>
          )}
          
          {state.messages.map((msg, i) => (
            <div 
              key={i} 
              className={`rounded-2xl p-4 ${msg.role === 'user' ? 'bg-slate-100' : 'bg-indigo-50'}`}
            >
              <p className={`text-xs uppercase tracking-wide mb-1 ${msg.role === 'user' ? 'text-slate-500' : 'text-indigo-500'}`}>
                {msg.role === 'user' ? 'Tú' : 'Maya'}
              </p>
              <p className={msg.role === 'user' ? 'text-slate-700' : 'text-indigo-900'}>
                {msg.text}
              </p>
              {msg.role === 'maya' && msg.audioUrl && (
                <a
                  href={msg.audioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
                >
                  <Download size={12} />
                  Download Audio
                </a>
              )}
            </div>
          ))}
          
          {/* Current user transcript while recording */}
          {state.userTranscript && !state.messages.some(m => m.role === 'user' && m.text === state.userTranscript) && (
            <div className="bg-slate-100 rounded-2xl p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Tú</p>
              <p className="text-slate-700">{state.userTranscript}</p>
            </div>
          )}
          
          {/* Current Maya response while speaking */}
          {state.mayaTranscript && !state.messages.some(m => m.role === 'maya' && m.text === state.mayaTranscript) && (
            <div className="bg-indigo-50 rounded-2xl p-4">
              <p className="text-xs text-indigo-500 uppercase tracking-wide mb-1">Maya</p>
              <p className="text-indigo-900">{state.mayaTranscript}</p>
              {state.audioDownloadUrl && (
                <a
                  href={state.audioDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
                >
                  <Download size={12} />
                  Download Audio
                </a>
              )}
            </div>
          )}

          {state.error && (
            <div className="bg-red-50 rounded-2xl p-4">
              <p className="text-red-600 text-sm">{state.error}</p>
            </div>
          )}

          {!state.userTranscript && !state.mayaTranscript && !state.error && (
            <p className="text-center text-slate-400 text-sm py-8">
              Mantén presionado el micrófono para hablar
            </p>
          )}
        </div>
      </div>

      {/* Push to talk button - fixed at bottom */}
      <div className="absolute bottom-0 inset-x-0 p-6 bg-white border-t border-slate-100">
        <button
          onMouseDown={handleMicPress}
          onMouseUp={handleMicPress}
          onTouchStart={handleMicPress}
          onTouchEnd={handleMicPress}
          disabled={state.vadState === 'processing'}
          className={`w-full py-5 rounded-full font-bold text-lg transition-all ${
            state.vadState === 'listening'
              ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 scale-95'
              : state.vadState === 'processing'
                ? 'bg-slate-200 text-slate-400 cursor-wait'
                : state.isMayaSpeaking
                  ? 'bg-amber-500 text-white'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/30'
          }`}
        >
          {state.vadState === 'listening' ? (
            <span className="flex items-center justify-center gap-2">
              <MicOff size={24} />
              Suelta para enviar
            </span>
          ) : state.vadState === 'processing' ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={24} className="animate-spin" />
              Procesando...
            </span>
          ) : state.isMayaSpeaking ? (
            <span className="flex items-center justify-center gap-2">
              <Volume2 size={24} />
              Maya está hablando...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Mic size={24} />
              Mantén para hablar
            </span>
          )}
        </button>
        
        <p className="mt-3 text-center text-xs text-slate-400">
          {state.isMayaSpeaking 
            ? 'Toca para interrumpir a Maya'
            : 'Maya responderá con 2-3 oraciones'}
        </p>
      </div>
    </div>
  );
}
