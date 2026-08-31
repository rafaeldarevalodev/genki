'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { X, Bot, Volume2, Check, Loader2 } from 'lucide-react';
import { useSettings } from '@/hooks/use-settings';
import { normalizeTTSProvider, type TTSProvider } from '@/lib/tts-provider';

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
  
  const [provider, setProvider] = useState<'local' | 'cloud'>('cloud');
  const [cloudModel, setCloudModel] = useState('moonshotai/kimi-k2.6');
  const [ttsProvider, setTtsProvider] = useState<TTSProvider>('f5tts');
  
  const [selectedKokoroVoice, setSelectedKokoroVoice] = useState('af_bella');
  const [selectedF5TTSVoice, setSelectedF5TTSVoice] = useState('en-Emma_woman');
  const [selectedPlaybackSpeed, setSelectedPlaybackSpeed] = useState(1);

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
        if (data.cloudModel) setCloudModel(data.cloudModel);
        setTtsProvider(normalizeTTSProvider(data.ttsProvider));
        if (data.kokoroVoice) setSelectedKokoroVoice(data.kokoroVoice);
        if (data.f5ttsVoice) setSelectedF5TTSVoice(data.f5ttsVoice);
        if (data.playbackSpeed) setSelectedPlaybackSpeed(data.playbackSpeed);
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
          cloudModel,
          ttsProvider,
          kokoroVoice: selectedKokoroVoice,
          f5ttsVoice: selectedF5TTSVoice,
          playbackSpeed: selectedPlaybackSpeed,
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

  const testTtsVoice = async (voiceId: string, tts: string) => {
    setTestingVoice(voiceId);
    setTestAudio(null);

    let url = 'http://localhost:8093/tts';
    let body: Record<string, string> = { text: 'Hello, this is a voice test.', voice: voiceId };

    if (tts === 'kokoro') {
      url = 'http://localhost:8880/v1/audio/speech';
      body = { input: 'Hello, this is a voice test.', voice: voiceId, speed: '1.0' };
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

  

  const ttsProviders: Array<{ id: TTSProvider; name: string; description: string }> = [
    { id: 'f5tts', name: 'F5-TTS', description: 'Fast, high quality voice cloning' },
    { id: 'kokoro', name: 'Kokoro', description: 'High quality neural voices' },
  ];

  const kokoroVoices = [
    { id: 'af_bella', name: 'Bella (Female)', accent: 'US' },
    { id: 'af_heart', name: 'Heart (Female)', accent: 'US' },
    { id: 'af_sky', name: 'Sky (Female)', accent: 'US' },
    { id: 'af_sarah', name: 'Sarah (Female)', accent: 'US' },
    { id: 'af_nova', name: 'Nova (Female)', accent: 'US' },
    { id: 'am_adam', name: 'Adam (Male)', accent: 'US' },
    { id: 'am_onyx', name: 'Onyx (Male)', accent: 'US' },
    { id: 'am_puck', name: 'Puck (Male)', accent: 'US' },
    { id: 'bm_george', name: 'George (Male)', accent: 'UK' },
    { id: 'bm_lewis', name: 'Lewis (Male)', accent: 'UK' },
  ];

  const f5ttsVoices = [
    { id: 'en-Emma_woman', name: 'Emma (Female)', accent: 'US', source: 'preset' },
    { id: 'en-Davis_man', name: 'Davis (Male)', accent: 'US', source: 'preset' },
    { id: 'en-Carter_man', name: 'Carter (Male)', accent: 'US', source: 'preset' },
    { id: 'en-Grace_woman', name: 'Grace (Female)', accent: 'US', source: 'preset' },
    { id: 'en-Mike_man', name: 'Mike (Male)', accent: 'US', source: 'preset' },
    { id: 'en-Frank_man', name: 'Frank (Male)', accent: 'US', source: 'preset' },
    { id: 'en-Sara_woman', name: 'Sara (Female)', accent: 'Custom', source: 'preset' },
    { id: 'en-Max_man', name: 'Max (Male)', accent: 'Custom', source: 'preset' },
    { id: 'en-July_Sexy_woman', name: 'July (Female)', accent: 'US', source: 'preset' },
    { id: 'en-Jane_woman', name: 'Jane (Female)', accent: 'US', source: 'preset' },
    { id: 'en-Giuseppe_man', name: 'Giuseppe (Male)', accent: 'Custom', source: 'preset' },
    { id: 'en-Andi_Male', name: 'Andi (Male)', accent: 'Custom', source: 'preset' },
    { id: 'en-Lady_female', name: 'Lady (Female)', accent: 'Custom', source: 'preset' },
    { id: 'en-Hanel_male', name: 'Hanel (Male)', accent: 'Custom', source: 'preset' },
    { id: 'en-Mark_Eng', name: 'Mark (Male)', accent: 'Custom', source: 'preset' },
  ];

  const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

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
                { id: 'cloud', name: 'Cloud (NVIDIA API)', description: 'Uses NVIDIA NIM cloud service' },
                { id: 'local', name: 'Local (LM Studio)', description: 'Runs offline on your computer' },
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
                  onClick={() => setTtsProvider(p.id)}
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

          {/* TTS Voice (Kokoro) */}
          {ttsProvider === 'kokoro' && (
            <div className="space-y-4">
              <div>
                <span className="text-sm font-medium text-slate-600 mb-2 block">Voice</span>
                <div className="space-y-2">
                  {kokoroVoices.map((voice) => (
                    <div
                      key={voice.id}
                      className={`flex items-center justify-between p-3 rounded-xl ${
                        selectedKokoroVoice === voice.id 
                          ? 'bg-indigo-50 border-2 border-indigo-600' 
                          : 'bg-slate-50 border-2 border-transparent'
                      }`}
                    >
                      <button
                        onClick={() => setSelectedKokoroVoice(voice.id)}
                        className="flex-1 text-left"
                      >
                        <span className="font-bold text-sm">{voice.name}</span>
                        <span className="text-xs text-slate-500 ml-2">{voice.accent}</span>
                      </button>
                      <button
                        onClick={() => testTtsVoice(voice.id, 'kokoro')}
                        disabled={testingVoice !== null}
                        className="text-xs bg-slate-200 px-2 py-1 rounded-lg disabled:opacity-50"
                      >
                        Test
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TTS Voice (F5-TTS) */}
          {ttsProvider === 'f5tts' && (
            <div className="space-y-4">
              <span className="text-xs text-slate-500 mb-2 block">
                Fast, high quality voice cloning — uses reference audio
              </span>
              <span className="text-sm font-medium text-slate-600 mb-2 block">Voice</span>
              <div className="space-y-2">
                {f5ttsVoices.map((voice) => (
                  <div
                    key={voice.id}
                    className={`flex items-center justify-between p-3 rounded-xl ${
                      selectedF5TTSVoice === voice.id
                        ? 'bg-indigo-50 border-2 border-indigo-600'
                        : 'bg-slate-50 border-2 border-transparent'
                    }`}
                  >
                    <button
                      onClick={() => setSelectedF5TTSVoice(voice.id)}
                      className="flex-1 text-left"
                    >
                      <span className="font-bold text-sm">{voice.name}</span>
                      <span className="text-xs text-slate-500 ml-2">{voice.accent}</span>
                    </button>
                    <button
                      onClick={() => testTtsVoice(voice.id, 'f5tts')}
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

          {/* Audio Test */}
          {testAudio && (
            <div className="mt-3 p-3 bg-green-50 rounded-xl">
              <audio controls className="w-full" src={testAudio} />
            </div>
          )}

          {/* Audio Playback Speed */}
          <div className="mt-6 pt-4 border-t border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <Volume2 size={18} className="text-indigo-600" />
              <h3 className="font-bold text-slate-700">Audio Playback Speed</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {PLAYBACK_SPEEDS.map((speed) => (
                <button
                  key={speed}
                  onClick={() => setSelectedPlaybackSpeed(speed)}
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                    selectedPlaybackSpeed === speed
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>

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
