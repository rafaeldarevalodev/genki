'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { X, Bot, Volume2, Check, Loader2 } from 'lucide-react';
import { useSettings } from '@/hooks/use-settings';

interface SettingsModalContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const SettingsModalContext = createContext<SettingsModalContextType>({
  isOpen: false,
  open: () => {},
  close: () => {},
});

export function useSettingsModal() {
  return useContext(SettingsModalContext);
}

export function SettingsModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <SettingsModalContext.Provider
      value={{
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
      }}
    >
      {children}
    </SettingsModalContext.Provider>
  );
}

export function SettingsModal() {
  const { isOpen, close } = useSettingsModal();
  const { refresh } = useSettings();
  
  const [provider, setProvider] = useState<'local' | 'cloud'>('local');
  const [localModel, setLocalModel] = useState<'gemma' | 'voxtral'>('gemma');
  const [cloudModel, setCloudModel] = useState('z-ai/glm-5.1');
  const [ttsProvider, setTtsProvider] = useState<'piper' | 'voxtral'>('voxtral');
  
  const [selectedVoice, setSelectedVoice] = useState('en_GB-alan-medium');
  const [selectedLMStudioVoice, setSelectedLMStudioVoice] = useState('en_us_aria');
  const [selectedEmotion, setSelectedEmotion] = useState('neutral');
  
  const [testingVoice, setTestingVoice] = useState<string | null>(null);
  const [testAudio, setTestAudio] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (data.provider) setProvider(data.provider);
        if (data.localModel) setLocalModel(data.localModel);
        if (data.cloudModel) setCloudModel(data.cloudModel);
        if (data.ttsProvider) setTtsProvider(data.ttsProvider);
        if (data.voice) setSelectedVoice(data.voice);
        if (data.lmstudioVoice) setSelectedLMStudioVoice(data.lmstudioVoice);
        if (data.emotion) setSelectedEmotion(data.emotion);
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    };
    
    loadSettings();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) setTestAudio(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          localModel,
          cloudModel,
          ttsProvider,
          voice: selectedVoice,
          lmstudioVoice: selectedLMStudioVoice,
          emotion: selectedEmotion,
        }),
      });
      await refresh();  // Refresh settings in context
      close();
    } catch (e) {
      console.error('Failed to save settings:', e);
    } finally {
      setSavingSettings(false);
    }
  };

  const testTtsVoice = async (voiceId: string, tts: string, emotion?: string) => {
    setTestingVoice(voiceId);
    setTestAudio(null);

    let url = 'http://localhost:8080/tts';
    let body: Record<string, string> = { text: 'Hello, this is a voice test.', voice: voiceId };

    if (tts === 'voxtral') {
      url = 'http://localhost:8000/v1/audio/speech';
      body = { input: 'Hello, this is a voice test.', voice: voiceId, emotion: emotion || 'neutral' };
    }
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error('TTS failed');
      const blob = await response.blob();
      setTestAudio(URL.createObjectURL(blob));
    } catch (error) {
      console.error('TTS test failed:', error);
      alert('TTS not available. Make sure the service is running.');
    } finally {
      setTestingVoice(null);
    }
  };

  const localModels = [
    { id: 'gemma', name: 'Gemma 4B', description: 'Fast, efficient for daily use' },
    { id: 'voxtral', name: 'Voxtral Small 24B', description: 'Best reasoning, needs more RAM' },
  ];

  const ttsProviders = [
    { id: 'piper', name: 'Piper', description: 'Local, fast, UK/US voices' },
    { id: 'voxtral', name: 'Voxtral', description: 'AI voices with emotion' },
  ];

  const piperVoices = [
    { id: 'en_GB-alan-medium', name: 'Alan (UK Male)', language: 'English (UK)' },
    { id: 'en_GB-semaine-medium', name: 'Semaine (UK Female)', language: 'English (UK)' },
    { id: 'en_US-lessac-high', name: 'Lessac (US Male)', language: 'English (US) - High' },
    { id: 'en_US-ryan-high', name: 'Ryan (US Male)', language: 'English (US) - High' },
    { id: 'en_US-lessac-medium', name: 'Lessac (US Male)', language: 'English (US) - Medium' },
  ];

  const lmStudioVoices = [
    { id: 'en_us_aria', name: 'Aria (Female)', accent: 'US' },
    { id: 'en_us_zoe', name: 'Zoe (Female)', accent: 'US' },
    { id: 'en_us_james', name: 'James (Male)', accent: 'US' },
  ];

  const emotions = [
    { id: 'neutral', name: 'Neutral' },
    { id: 'cheerful', name: 'Cheerful' },
    { id: 'empathetic', name: 'Empathetic' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white p-4 border-b border-slate-100 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-xl font-black">Settings</h2>
          <button onClick={close} className="p-2 hover:bg-slate-100 rounded-xl">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 space-y-6">
          {/* LLM Provider */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Bot size={18} className="text-indigo-600" />
              <h3 className="font-bold text-slate-700">AI Model Provider</h3>
            </div>
            <div className="space-y-2">
              {[
                { id: 'local', name: 'Local (LM Studio)', description: 'Runs offline on your computer' },
                { id: 'cloud', name: 'Cloud (NVIDIA API)', description: 'Uses NVIDIA NIM cloud service' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProvider(p.id as 'local' | 'cloud')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-left ${
                    provider === p.id 
                      ? 'bg-indigo-50 border-2 border-indigo-600' 
                      : 'bg-slate-50 border-2 border-transparent hover:border-slate-200'
                  }`}
                >
                  <div>
                    <span className="font-bold text-sm">{p.name}</span>
                    <span className="text-xs text-slate-500 block">{p.description}</span>
                  </div>
                  {provider === p.id && (
                    <div className="bg-indigo-600 text-white p-1 rounded-full">
                      <Check size={12} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Local Model Selection */}
          {provider === 'local' && (
            <div>
              <span className="text-sm font-medium text-slate-600 mb-2 block">Local Model</span>
              <div className="space-y-2">
                {localModels.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setLocalModel(m.id as 'gemma' | 'voxtral')}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-left ${
                      localModel === m.id 
                        ? 'bg-indigo-50 border-2 border-indigo-600' 
                        : 'bg-slate-50 border-2 border-transparent hover:border-slate-200'
                    }`}
                  >
                    <div>
                      <span className="font-bold text-sm">{m.name}</span>
                      <span className="text-xs text-slate-500 block">{m.description}</span>
                    </div>
                    {localModel === m.id && (
                      <div className="bg-indigo-600 text-white p-1 rounded-full">
                        <Check size={12} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cloud Model Input */}
          {provider === 'cloud' && (
            <div>
              <span className="text-sm font-medium text-slate-600 mb-2 block">Cloud Model</span>
              <input
                type="text"
                value={cloudModel}
                onChange={(e) => setCloudModel(e.target.value)}
                placeholder="z-ai/glm-5.1"
                className="w-full p-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 outline-none text-sm"
              />
              <span className="text-xs text-slate-500 mt-1 block">
                Enter the model name from NVIDIA API
              </span>
            </div>
          )}

          {/* TTS Provider */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Volume2 size={18} className="text-indigo-600" />
              <h3 className="font-bold text-slate-700">TTS Provider</h3>
            </div>
            <div className="space-y-2">
              {ttsProviders.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setTtsProvider(p.id as 'piper' | 'voxtral')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-left ${
                    ttsProvider === p.id 
                      ? 'bg-indigo-50 border-2 border-indigo-600' 
                      : 'bg-slate-50 border-2 border-transparent hover:border-slate-200'
                  }`}
                >
                  <div>
                    <span className="font-bold text-sm">{p.name}</span>
                    <span className="text-xs text-slate-500 block">{p.description}</span>
                  </div>
                  {ttsProvider === p.id && (
                    <div className="bg-indigo-600 text-white p-1 rounded-full">
                      <Check size={12} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* TTS Voice (Piper) */}
          {ttsProvider === 'piper' && (
            <div>
              <span className="text-sm font-medium text-slate-600 mb-2 block">Voice</span>
              <div className="space-y-2">
                {piperVoices.map((voice) => (
                  <div
                    key={voice.id}
                    className={`flex items-center justify-between p-3 rounded-xl ${
                      selectedVoice === voice.id 
                        ? 'bg-indigo-50 border-2 border-indigo-600' 
                        : 'bg-slate-50 border-2 border-transparent'
                    }`}
                  >
                    <button
                      onClick={() => setSelectedVoice(voice.id)}
                      className="flex-1 text-left"
                    >
                      <span className="font-bold text-sm">{voice.name}</span>
                      <span className="text-xs text-slate-500 ml-2">{voice.language}</span>
                    </button>
                    <button
                      onClick={() => testTtsVoice(voice.id, 'piper')}
                      disabled={testingVoice !== null}
                      className="text-xs bg-slate-200 px-2 py-1 rounded-lg disabled:opacity-50"
                    >
                      Test
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TTS Voice (Voxtral) */}
          {ttsProvider === 'voxtral' && (
            <div className="space-y-4">
              <div>
                <span className="text-sm font-medium text-slate-600 mb-2 block">Voice</span>
                <div className="space-y-2">
                  {lmStudioVoices.map((voice) => (
                    <div
                      key={voice.id}
                      className={`flex items-center justify-between p-3 rounded-xl ${
                        selectedLMStudioVoice === voice.id 
                          ? 'bg-indigo-50 border-2 border-indigo-600' 
                          : 'bg-slate-50 border-2 border-transparent'
                      }`}
                    >
                      <button
                        onClick={() => setSelectedLMStudioVoice(voice.id)}
                        className="flex-1 text-left"
                      >
                        <span className="font-bold text-sm">{voice.name}</span>
                        <span className="text-xs text-slate-500 ml-2">{voice.accent}</span>
                      </button>
                      <button
                        onClick={() => testTtsVoice(voice.id, 'voxtral', selectedEmotion)}
                        disabled={testingVoice !== null}
                        className="text-xs bg-slate-200 px-2 py-1 rounded-lg disabled:opacity-50"
                      >
                        Test
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-sm font-medium text-slate-600 mb-2 block">Emotion</span>
                <div className="flex flex-wrap gap-2">
                  {emotions.map((emotion) => (
                    <button
                      key={emotion.id}
                      onClick={() => setSelectedEmotion(emotion.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                        selectedEmotion === emotion.id
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {emotion.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Audio Test */}
          {testAudio && (
            <div className="mt-3 p-3 bg-green-50 rounded-xl">
              <audio controls className="w-full" src={testAudio} />
            </div>
          )}

          {/* Save Button */}
          <button
            onClick={saveSettings}
            disabled={savingSettings}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50"
          >
            {savingSettings && <Loader2 className="animate-spin" size={18} />}
            {savingSettings ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}