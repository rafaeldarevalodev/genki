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
  const [ttsProvider, setTtsProvider] = useState<'piper' | 'voxtral' | 'kokoro' | 'vibevoice' | 'vibevoice7b'>('kokoro');
  
  const [selectedVoice, setSelectedVoice] = useState('en_GB-alan-medium');
  const [selectedLMStudioVoice, setSelectedLMStudioVoice] = useState('en_us_aria');
  const [selectedKokoroVoice, setSelectedKokoroVoice] = useState('af_bella');
  const [selectedVibeVoice, setSelectedVibeVoice] = useState('en-Emma_woman');
  const [selectedVibeVoice7B, setSelectedVibeVoice7B] = useState('en-Emma_woman');
  const [selectedPlaybackSpeed, setSelectedPlaybackSpeed] = useState(1);
  const [userVoices7B, setUserVoices7B] = useState<Array<{id: string, name: string, data: string}>>([]);

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
        if (data.kokoroVoice) setSelectedKokoroVoice(data.kokoroVoice);
        if (data.vibevoiceVoice) setSelectedVibeVoice(data.vibevoiceVoice);
        if (data.vibevoice7bVoice) setSelectedVibeVoice7B(data.vibevoice7bVoice);
        if (data.playbackSpeed) setSelectedPlaybackSpeed(data.playbackSpeed);
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    };
    
    loadSettings();

    // Load user voices from localStorage
    try {
      const stored = localStorage.getItem('vibevoice7b_user_voices');
      if (stored) {
        setUserVoices7B(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load user voices:', e);
    }
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
          kokoroVoice: selectedKokoroVoice,
          vibevoiceVoice: selectedVibeVoice,
          vibevoice7bVoice: selectedVibeVoice7B,
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

    // Map frontend voice IDs to Voxtral voice embeddings
    const voiceMap: Record<string, string> = {
      'en_us_aria': 'casual_female',
      'en_us_zoe': 'cheerful_female',
      'en_us_james': 'casual_male',
    };

    let url = 'http://localhost:8080/tts';
    let body: Record<string, string> = { text: 'Hello, this is a voice test.', voice: voiceId };

    if (tts === 'voxtral') {
      url = 'http://localhost:8000/v1/audio/speech';
      const voxtralVoice = voiceMap[voiceId] || 'casual_male';
      body = { input: 'Hello, this is a voice test.', voice: voxtralVoice };
    }
    
    if (tts === 'kokoro') {
      url = 'http://localhost:8880/v1/audio/speech';
      body = { input: 'Hello, this is a voice test.', voice: voiceId, speed: '1.0' };
    }

    if (tts === 'vibevoice') {
      url = 'http://localhost:8090/v1/audio/speech';
      body = { input: 'Hello, this is a voice test.', voice: voiceId };
    }

    if (tts === 'vibevoice7b') {
      url = 'http://localhost:8091/v1/audio/speech';
      body = { input: 'Hello, this is a voice test.', voice: voiceId };
      // Check if it's a user voice and add reference audio data
      const userVoice = userVoices7B.find(v => v.id === voiceId);
      if (userVoice) {
        body = { ...body, reference_audio_data: userVoice.data };
      }
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
    { id: 'kokoro', name: 'Kokoro', description: 'High quality neural voices' },
    { id: 'voxtral', name: 'Voxtral', description: 'Fast AI voices' },
    { id: 'vibevoice', name: 'VibeVoice 0.5B', description: 'Microsoft realtime, ~300ms latency' },
    { id: 'vibevoice7b', name: 'VibeVoice 7B', description: 'Microsoft large model, best quality, 22GB RAM' },
  ];

  const piperVoices = [
    { id: 'en_GB-alan-medium', name: 'Alan (UK Male)', language: 'English (UK)' },
    { id: 'en_GB-semaine-medium', name: 'Semaine (UK Female)', language: 'English (UK)' },
    { id: 'en_US-lessac-high', name: 'Lessac (US Male)', language: 'English (US) - High' },
    { id: 'en_US-ryan-high', name: 'Ryan (US Male)', language: 'English (US) - High' },
    { id: 'en_US-lessac-medium', name: 'Lessac (US Male)', language: 'English (US) - Medium' },
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

  const vibevoiceVoices = [
    { id: 'en-Emma_woman', name: 'Emma (Female)', accent: 'US' },
    { id: 'en-Davis_man', name: 'Davis (Male)', accent: 'US' },
    { id: 'en-Carter_man', name: 'Carter (Male)', accent: 'US' },
    { id: 'en-Grace_woman', name: 'Grace (Female)', accent: 'US' },
    { id: 'en-Mike_man', name: 'Mike (Male)', accent: 'US' },
    { id: 'en-Frank_man', name: 'Frank (Male)', accent: 'US' },
  ];

  const vibevoice7bVoices = [
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
  ];

  const lmStudioVoices = [
    { id: 'en_us_aria', name: 'Aria (Female)', accent: 'US' },
    { id: 'en_us_zoe', name: 'Zoe (Female)', accent: 'US' },
    { id: 'en_us_james', name: 'James (Male)', accent: 'US' },
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
                  onClick={() => setTtsProvider(p.id as 'piper' | 'voxtral' | 'kokoro' | 'vibevoice' | 'vibevoice7b')}
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
                        onClick={() => testTtsVoice(voice.id, 'voxtral')}
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

          {/* TTS Voice (VibeVoice) */}
          {ttsProvider === 'vibevoice' && (
            <div className="space-y-4">
              <div>
                <span className="text-xs text-slate-500 mb-2 block">
                  0.5B model — fast, lightweight, some quality degradation on long audio
                </span>
                <span className="text-sm font-medium text-slate-600 mb-2 block">Voice</span>
                <div className="space-y-2">
                  {vibevoiceVoices.map((voice) => (
                    <div
                      key={voice.id}
                      className={`flex items-center justify-between p-3 rounded-xl ${
                        selectedVibeVoice === voice.id
                          ? 'bg-indigo-50 border-2 border-indigo-600'
                          : 'bg-slate-50 border-2 border-transparent'
                      }`}
                    >
                      <button
                        onClick={() => setSelectedVibeVoice(voice.id)}
                        className="flex-1 text-left"
                      >
                        <span className="font-bold text-sm">{voice.name}</span>
                        <span className="text-xs text-slate-500 ml-2">{voice.accent}</span>
                      </button>
                      <button
                        onClick={() => testTtsVoice(voice.id, 'vibevoice')}
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

          {/* TTS Voice (VibeVoice 7B) */}
          {ttsProvider === 'vibevoice7b' && (
            <div className="space-y-4">
              <div>
                <span className="text-xs text-slate-500 mb-2 block">
                  7B model — best quality, requires ~22GB RAM
                </span>
                <span className="text-sm font-medium text-slate-600 mb-2 block">Voice</span>
                <div className="space-y-2">
                  {vibevoice7bVoices.map((voice) => (
                    <div
                      key={voice.id}
                      className={`flex items-center justify-between p-3 rounded-xl ${
                        selectedVibeVoice7B === voice.id
                          ? 'bg-indigo-50 border-2 border-indigo-600'
                          : 'bg-slate-50 border-2 border-transparent'
                      }`}
                    >
                      <button
                        onClick={() => setSelectedVibeVoice7B(voice.id)}
                        className="flex-1 text-left"
                      >
                        <span className="font-bold text-sm">{voice.name}</span>
                        <span className="text-xs text-slate-500 ml-2">{voice.accent}</span>
                      </button>
                      <button
                        onClick={() => testTtsVoice(voice.id, 'vibevoice7b')}
                        disabled={testingVoice !== null}
                        className="text-xs bg-slate-200 px-2 py-1 rounded-lg disabled:opacity-50"
                      >
                        Test
                      </button>
                    </div>
                  ))}
                </div>

                {/* User voices */}
                {userVoices7B.length > 0 && (
                  <div className="mt-4">
                    <span className="text-sm font-medium text-slate-600 mb-2 block">Your Voices</span>
                    <div className="space-y-2">
                      {userVoices7B.map((voice) => (
                        <div
                          key={voice.id}
                          className={`flex items-center justify-between p-3 rounded-xl ${
                            selectedVibeVoice7B === voice.id
                              ? 'bg-indigo-50 border-2 border-indigo-600'
                              : 'bg-slate-50 border-2 border-transparent'
                          }`}
                        >
                          <button
                            onClick={() => setSelectedVibeVoice7B(voice.id)}
                            className="flex-1 text-left"
                          >
                            <span className="font-bold text-sm">{voice.name}</span>
                            <span className="text-xs text-slate-500 ml-2">Custom</span>
                          </button>
                          <button
                            onClick={() => testTtsVoice(voice.id, 'vibevoice7b')}
                            disabled={testingVoice !== null}
                            className="text-xs bg-slate-200 px-2 py-1 rounded-lg disabled:opacity-50 mr-2"
                          >
                            Test
                          </button>
                          <button
                            onClick={() => {
                              const updated = userVoices7B.filter(v => v.id !== voice.id);
                              setUserVoices7B(updated);
                              localStorage.setItem('vibevoice7b_user_voices', JSON.stringify(updated));
                            }}
                            className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-lg hover:bg-red-200"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upload new voice */}
                <div className="mt-4">
                  <input
                    type="file"
                    id="voice-upload"
                    accept="audio/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      if (file.size > 5 * 1024 * 1024) {
                        alert('File too large. Maximum size is 5MB.');
                        return;
                      }

                      const reader = new FileReader();
                      reader.onload = () => {
                        const base64 = (reader.result as string).split(',')[1];
                        const voiceName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
                        const newVoice = {
                          id: `user_${Date.now()}`,
                          name: voiceName,
                          data: base64,
                        };
                        const updated = [...userVoices7B, newVoice];
                        setUserVoices7B(updated);
                        localStorage.setItem('vibevoice7b_user_voices', JSON.stringify(updated));
                        setSelectedVibeVoice7B(newVoice.id);
                      };
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }}
                  />
                  <label
                    htmlFor="voice-upload"
                    className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
                  >
                    <span className="text-sm font-medium text-slate-600">Upload Voice Reference</span>
                    <span className="text-xs text-slate-400">(max 5MB)</span>
                  </label>
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