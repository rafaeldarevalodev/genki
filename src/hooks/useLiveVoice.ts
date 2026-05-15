'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

function generateId(): string {
  return crypto.randomUUID();
}

export type LiveVoiceMode = 'chat' | 'voice';
export type VadState = 'idle' | 'listening' | 'speaking' | 'processing';

export interface ChatMessage {
  role: 'user' | 'maya';
  text: string;
  audioUrl?: string;
}

export interface LiveVoiceState {
  mode: LiveVoiceMode;
  vadState: VadState;
  userTranscript: string;
  mayaTranscript: string;
  isMayaSpeaking: boolean;
  sessionId: string;
  error: string | null;
  audioDownloadUrl: string | null;
  messages: ChatMessage[];
}

export interface UseLiveVoiceOptions {
  endpoint?: string;
  onUserTranscript?: (text: string) => void;
  onMayaResponse?: (text: string) => void;
  onMayaSpeaking?: (speaking: boolean) => void;
  onError?: (error: string) => void;
  mode?: 'fast' | 'immersive';
  vocabulary?: string[];
}

export interface UseLiveVoiceReturn {
  state: LiveVoiceState;
  startListening: () => Promise<void>;
  interrupt: () => void;
  toggleMode: (mode: LiveVoiceMode) => void;
  setMayaVoice: (voiceId: string) => void;
  isRecording: boolean;
}

const DEFAULT_ENDPOINT = '/api/maya/conversation';
const MAYA_VOICE_STORAGE_KEY = 'maya_voice_id';
const DEFAULT_MAYA_VOICE = 'en-Emma_woman';

export function useLiveVoice(options: UseLiveVoiceOptions = {}): UseLiveVoiceReturn {
  const {
    endpoint = DEFAULT_ENDPOINT,
    onUserTranscript,
    onMayaResponse,
    onMayaSpeaking,
    onError,
    mode = 'fast',
    vocabulary = []
  } = options;

  const [state, setState] = useState<LiveVoiceState>({
    mode: 'chat',
    vadState: 'idle',
    userTranscript: '',
    mayaTranscript: '',
    isMayaSpeaking: false,
      sessionId: generateId(),
    error: null,
    audioDownloadUrl: null,
    messages: []
  });

  // Load Maya voice from localStorage
  const [mayaVoiceId, setMayaVoiceId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(MAYA_VOICE_STORAGE_KEY) || DEFAULT_MAYA_VOICE;
    }
    return DEFAULT_MAYA_VOICE;
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  const resetSession = useCallback(async () => {
    try {
      await fetch('/api/maya/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: state.sessionId })
      });
    } catch (e) {
      console.warn('[useLiveVoice] Session reset failed:', e);
    }
  }, [state.sessionId]);

  useEffect(() => {
    workerRef.current = new Worker(
      '/workers/audio-stream.worker.js'
    );

    workerRef.current.onmessage = (event) => {
      const { type, samples, sampleRate } = event.data;
      
      if (type === 'samples') {
        console.log('[useLiveVoice] Received samples:', samples.length, 'at', sampleRate, 'Hz');
        playAudio(samples, sampleRate);
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
}, []);

  const playAudio = (samples: number[], sampleRate: number) => {
    try {
      console.log('[useLiveVoice] playAudio called with', samples.length, 'samples');
      
      // Stop any existing playback first
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop();
        } catch (e) {
          // Ignore errors from stopped source
        }
        sourceNodeRef.current = null;
      }
      
      // Close existing AudioContext if it's in suspended state
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      // Create NEW audio context every time to avoid issues
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      
      console.log('[useLiveVoice] AudioContext created, state:', ctx.state);
      
      // Convert samples to Float32Array
      const float32Array = new Float32Array(samples);
      
      // Create audio buffer
      const buffer = ctx.createBuffer(1, float32Array.length, sampleRate);
      buffer.getChannelData(0).set(float32Array);
      
      console.log('[useLiveVoice] Buffer created, duration:', buffer.duration, 'seconds');
      
      // Create and connect source
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      sourceNodeRef.current = source;
      
      source.onended = () => {
        console.log('[useLiveVoice] Playback ended');
        sourceNodeRef.current = null;
      };
      
      source.onerror = (err) => {
        console.error('[useLiveVoice] Source error:', err);
      };
      
      // Start playback immediately
      source.start();
      console.log('[useLiveVoice] Playback started');
      
    } catch (err) {
      console.error('[useLiveVoice] Audio playback error:', err);
    }
  };

  const interrupt = useCallback(() => {
    console.log('[useLiveVoice] Interrupt called');

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'abort' });
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    // Stop audio playback
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch {}
      sourceNodeRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setState(prev => ({
      ...prev,
      vadState: 'idle',
      isMayaSpeaking: false,
      error: null
    }));
  }, []);

  const startListening = useCallback(async () => {
    console.log('[useLiveVoice] Start listening');
    
    try {
      interrupt();
    } catch (e) {
      // Ignore interrupt errors
    }

    setState(prev => ({
      ...prev,
      vadState: 'listening',
      userTranscript: '',
      mayaTranscript: '',
      error: null,
      audioDownloadUrl: null
    }));

    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      } 
    });

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus'
    });
    
    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      console.log('[useLiveVoice] Recording stopped, processing...');
      setState(prev => ({ ...prev, vadState: 'processing' }));

      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      // Convert to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer)
          .reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_audio: base64,
            session_id: state.sessionId,
            mode: mode,
            vocabulary: vocabulary,
            voice_id: mayaVoiceId
          }),
          signal: abortControllerRef.current.signal
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let lineBuffer = '';

        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          lineBuffer += decoder.decode(value, { stream: true });
          
          // Process complete lines (ending with newline)
          const lines = lineBuffer.split('\n');
          lineBuffer = lines.pop() || ''; // Keep incomplete line in buffer
          
          for (const line of lines) {
            if (!line.trim()) continue;
            
            try {
              const chunk = JSON.parse(line);
              
              switch (chunk.type) {
                case 'transcription': {
                  const transcript = chunk.data?.text || '';
                  setState(prev => ({ 
                    ...prev, 
                    userTranscript: transcript,
                    messages: [...prev.messages, { role: 'user', text: transcript }]
                  }));
                  onUserTranscript?.(transcript);
                  break;
                }
                
                case 'maya_response': {
                  const response = chunk.data?.text || '';
                  setState(prev => ({ 
                    ...prev, 
                    mayaTranscript: response,
                    isMayaSpeaking: true,
                    messages: [...prev.messages, { role: 'maya', text: response }]
                  }));
                  onMayaResponse?.(response);
                  onMayaSpeaking?.(true);
                  break;
                }
                
                case 'audio_chunk': {
                  console.log('[useLiveVoice] audio_chunk received:', JSON.stringify(chunk));
                  if (workerRef.current) {
                    try {
                      workerRef.current.postMessage({
                        type: 'chunk',
                        data: {
                          data: chunk.data?.data,
                          sample_rate: chunk.data?.sample_rate || 24000,
                          compressed: chunk.data?.compressed || false
                        }
                      });
                      
                      console.log('[useLiveVoice] download_url from chunk:', chunk.data?.download_url);
                      if (chunk.data?.download_url) {
                        console.log('[useLiveVoice] Setting audioDownloadUrl:', chunk.data.download_url);
                        setState(prev => {
                          const newMessages = [...prev.messages];
                          const lastMayaIndex = newMessages.findLastIndex(m => m.role === 'maya');
                          if (lastMayaIndex !== -1) {
                            newMessages[lastMayaIndex] = { ...newMessages[lastMayaIndex], audioUrl: chunk.data.download_url };
                          }
                          return { ...prev, audioDownloadUrl: chunk.data.download_url, messages: newMessages };
                        });
                      }
                    } catch (err) {
                      console.error('[useLiveVoice] Worker postMessage error:', err);
                    }
                  }
                  break;
                }
                
                case 'status': {
                  if (chunk.data?.stage === 'speaking') {
                    setState(prev => ({ ...prev, isMayaSpeaking: true }));
                    onMayaSpeaking?.(true);
                  }
                  break;
                }
                
                case 'end': {
                  setState(prev => ({ 
                    ...prev, 
                    vadState: 'idle',
                    isMayaSpeaking: false 
                  }));
                  onMayaSpeaking?.(false);
                  break;
                }
                
                case 'vad': {
                  if (!chunk.data?.detected) {
                    console.log('[useLiveVoice] No speech detected');
                    setState(prev => ({ ...prev, vadState: 'idle' }));
                    return;
                  }
                  break;
                }
                
                case 'error': {
                  const errorMsg = chunk.data?.message || chunk.message || 'Unknown error';
                  setState(prev => ({ 
                    ...prev, 
                    error: errorMsg,
                    vadState: 'idle',
                    isMayaSpeaking: false
                  }));
                  onError?.(errorMsg);
                  onMayaSpeaking?.(false);
                  break;
                }
              }
            } catch (e) {
              console.warn('[useLiveVoice] Parse error:', e, 'Line:', line.substring(0, 100));
            }
          }
        }
        
        // Process any remaining data in buffer
        if (lineBuffer.trim()) {
          try {
            const chunk = JSON.parse(lineBuffer);
            // Handle end type for proper cleanup
            if (chunk.type === 'end') {
              setState(prev => ({ 
                ...prev, 
                vadState: 'idle',
                isMayaSpeaking: false 
              }));
              onMayaSpeaking?.(false);
            }
          } catch (e) {
            console.warn('[useLiveVoice] Final parse error:', e);
          }
        }
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        
        if (errorMessage.includes('abort') || errorMessage.includes('cancelled')) {
          console.log('[useLiveVoice] Request cancelled (expected during interrupt)');
          return;
        }
        
        console.error('[useLiveVoice] Error:', e);
        setState(prev => ({ 
          ...prev, 
          error: errorMessage,
          vadState: 'idle',
          isMayaSpeaking: false 
        }));
        onError?.(errorMessage);
        onMayaSpeaking?.(false);
      } finally {
        stream.getTracks().forEach(track => track.stop());
      }
    };

    mediaRecorder.start(100);

    setTimeout(() => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    }, 5000);

  }, [endpoint, mode, vocabulary, state.sessionId, interrupt, onUserTranscript, onMayaResponse, onMayaSpeaking, onError]);

  const toggleMode = useCallback((newMode: LiveVoiceMode) => {
    if (newMode === 'voice') {
      resetSession();
    }
    setState(prev => ({ 
      ...prev, 
      mode: newMode,
      sessionId: newMode === 'voice' ? generateId() : prev.sessionId
    }));
  }, [resetSession]);

  const setMayaVoice = useCallback((voiceId: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(MAYA_VOICE_STORAGE_KEY, voiceId);
    }
    setMayaVoiceId(voiceId);
    console.log('[useLiveVoice] Maya voice set to:', voiceId);
  }, []);

  return {
    state,
    startListening,
    interrupt,
    toggleMode,
    setMayaVoice,
    isRecording: state.vadState === 'listening'
  };
}
