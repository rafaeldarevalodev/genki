'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { X, Bot, Volume2, Check } from 'lucide-react';

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
  const [selectedVoice, setSelectedVoice] = useState('en_GB-alan-medium');
  const [selectedLMStudioVoice, setSelectedLMStudioVoice] = useState('en_us_aria');
  const [selectedEmotion, setSelectedEmotion] = useState('neutral');
  const [selectedModel, setSelectedModel] = useState('voxtral');
  const [ttsProvider, setTtsProvider] = useState('piper');
  const [testingVoice, setTestingVoice] = useState<string | null>(null);
  const [testAudio, setTestAudio] = useState<string | null>(null);

  useEffect(() => {
    const savedVoice = localStorage.getItem('tts-voice');
    if (savedVoice) setSelectedVoice(savedVoice);
    const savedLMStudioVoice = localStorage.getItem('lmstudio-voice');
    if (savedLMStudioVoice) setSelectedLMStudioVoice(savedLMStudioVoice);
    const savedEmotion = localStorage.getItem('lmstudio-emotion');
    if (savedEmotion) setSelectedEmotion(savedEmotion);
    const savedModel = localStorage.getItem('llm-model');
    if (savedModel) setSelectedModel(savedModel);
    const savedTts = localStorage.getItem('tts-provider');
    if (savedTts) setTtsProvider(savedTts);
  }, []);

  useEffect(() => {
    if (!isOpen) setTestAudio(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    localStorage.setItem('llm-model', model);
  };

  const handleTtsProviderChange = (provider: string) => {
    setTtsProvider(provider);
    localStorage.setItem('tts-provider', provider);
  };

  const handleVoiceChange = (voiceId: string) => {
    setSelectedVoice(voiceId);
    localStorage.setItem('tts-voice', voiceId);
  };

  const handleLMStudioVoiceChange = (voiceId: string) => {
    setSelectedLMStudioVoice(voiceId);
    localStorage.setItem('lmstudio-voice', voiceId);
  };

  const handleEmotionChange = (emotion: string) => {
    setSelectedEmotion(emotion);
    localStorage.setItem('lmstudio-emotion', emotion);
  };

  const testTtsVoice = async (voiceId: string, provider: string, emotion?: string) => {
    setTestingVoice(voiceId);
    setTestAudio(null);

    if (provider === 'voxtral_tts') {
      console.log('[testTtsVoice] Trying Voxtral TTS...');
      try {
        const response = await fetch('http://localhost:8000/v1/audio/speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: 'Hello, this is a voice test.',
            voice: voiceId,
            emotion: emotion || 'neutral'
          })
        });

        if (response.ok) {
          const blob = await response.blob();
          setTestAudio(URL.createObjectURL(blob));
          setTestingVoice(null);
          return;
        }
      } catch (e) {
        console.log('[testTtsVoice] Voxtral TTS unavailable:', e);
      }
      console.log('[testTtsVoice] Falling back to Piper...');
      provider = 'piper';
      voiceId = 'en_GB-alan-medium';
    }
    
    // Piper fallback
    try {
      const response = await fetch('http://localhost:8080/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Hello, this is a voice test.',
          voice: voiceId || 'en_GB-alan-medium'
        })
      });

      if (!response.ok) throw new Error('Piper TTS failed');
      const blob = await response.blob();
      setTestAudio(URL.createObjectURL(blob));
    } catch (error) {
      console.error('TTS test failed:', error);
      alert('No TTS server available. Make sure Piper TTS is running on port 8080.');
    } finally {
      setTestingVoice(null);
    }
  };

  const piperVoices = [
    { id: 'en_GB-alan-medium', name: 'Alan', language: 'English (UK)', quality: 'Medium', gender: 'Male' },
    { id: 'en_GB-semaine-medium', name: 'Semaine', language: 'English (UK)', quality: 'Medium', gender: 'Female' },
    { id: 'en_US-lessac-high', name: 'Lessac', language: 'English (US)', quality: 'High', gender: 'Male' },
    { id: 'en_US-ryan-high', name: 'Ryan', language: 'English (US)', quality: 'High', gender: 'Male' },
    { id: 'en_US-lessac-medium', name: 'Lessac', language: 'English (US)', quality: 'Medium', gender: 'Male' },
  ];

  const lmStudioVoices = [
    { id: 'en_us_aria', name: 'Aria', accent: 'US', style: 'Clear Tutor' },
    { id: 'en_us_james', name: 'James', accent: 'US', style: 'Natural' },
    { id: 'en_gb_sophie', name: 'Sophie', accent: 'UK', style: 'Elegant' },
    { id: 'en_gb_oliver', name: 'Oliver', accent: 'UK', style: 'Academic' },
    { id: 'en_us_zoe', name: 'Zoe', accent: 'US', style: 'Youth' },
  ];

  const emotions = [
    { id: 'neutral', name: 'Neutral' },
    { id: 'cheerful', name: 'Cheerful' },
    { id: 'empathetic', name: 'Empathetic' },
    { id: 'excited', name: 'Excited' },
  ];

  const models = [
    { id: 'voxtral', name: 'Voxtral Small 24B', description: 'Primary model with advanced reasoning' },
    { id: 'gemma', name: 'Gemma 4 26B', description: 'Backup model' },
  ];

  const ttsProviders = [
    { id: 'piper', name: 'Piper TTS', description: 'High-quality local voices (UK/US)' },
    { id: 'voxtral_tts', name: 'Voxtral TTS', description: 'AI-powered voices with emotion (M3 Max GPU)' },
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
        
        <div className="p-4">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Bot size={18} className="text-indigo-600" />
              <h3 className="font-bold text-slate-700">AI Model</h3>
            </div>
            <div className="space-y-2">
              {models.map((model) => (
                <button
                  key={model.id}
                  onClick={() => handleModelChange(model.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-left ${
                    selectedModel === model.id 
                      ? 'bg-indigo-50 border-2 border-indigo-600' 
                      : 'bg-slate-50 border-2 border-transparent hover:border-slate-200'
                  }`}
                >
                  <div>
                    <span className="font-bold text-sm">{model.name}</span>
                    <span className="text-xs text-slate-500 block">{model.description}</span>
                  </div>
                  {selectedModel === model.id && (
                    <div className="bg-indigo-600 text-white p-1 rounded-full">
                      <Check size={12} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Volume2 size={18} className="text-indigo-600" />
              <h3 className="font-bold text-slate-700">TTS</h3>
            </div>

            <div className="space-y-2 mb-4">
              {ttsProviders.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => handleTtsProviderChange(provider.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-left ${
                    ttsProvider === provider.id 
                      ? 'bg-indigo-50 border-2 border-indigo-600' 
                      : 'bg-slate-50 border-2 border-transparent hover:border-slate-200'
                  }`}
                >
                  <div>
                    <span className="font-bold text-sm">{provider.name}</span>
                    <span className="text-xs text-slate-500 block">{provider.description}</span>
                  </div>
                  {ttsProvider === provider.id && (
                    <div className="bg-indigo-600 text-white p-1 rounded-full">
                      <Check size={12} />
                    </div>
                  )}
                </button>
              ))}
            </div>

            {ttsProvider === 'piper' && (
              <div className="space-y-2">
                {piperVoices.map((voice) => (
                  <div
                    key={voice.id}
                    onClick={() => handleVoiceChange(voice.id)}
                    className={`flex items-center justify-between p-3 rounded-xl cursor-pointer ${
                      selectedVoice === voice.id 
                        ? 'bg-indigo-50 border-2 border-indigo-600' 
                        : 'bg-slate-50 border-2 border-transparent'
                    }`}
                  >
                    <div>
                      <span className="font-bold text-sm">{voice.name}</span>
                      <span className="text-xs text-slate-500 ml-2">{voice.language}</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); testTtsVoice(voice.id, 'piper'); }}
                      disabled={testingVoice !== null}
                      className="text-xs bg-slate-200 px-2 py-1 rounded-lg disabled:opacity-50"
                    >
                      Test
                    </button>
                  </div>
                ))}
              </div>
            )}

            {ttsProvider === 'voxtral_tts' && (
              <div className="space-y-4">
                <div>
                  <span className="text-sm font-medium text-slate-600 mb-2 block">Voice</span>
                  <div className="space-y-2">
                    {lmStudioVoices.map((voice) => (
                      <div
                        key={voice.id}
                        onClick={() => handleLMStudioVoiceChange(voice.id)}
                        className={`flex items-center justify-between p-3 rounded-xl cursor-pointer ${
                          selectedLMStudioVoice === voice.id 
                            ? 'bg-indigo-50 border-2 border-indigo-600' 
                            : 'bg-slate-50 border-2 border-transparent'
                        }`}
                      >
                        <div>
                          <span className="font-bold text-sm">{voice.name}</span>
                          <span className="text-xs text-slate-500 ml-2">{voice.accent} - {voice.style}</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); testTtsVoice(voice.id, 'voxtral_tts', selectedEmotion); }}
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
                        onClick={() => handleEmotionChange(emotion.id)}
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

            {testAudio && (
              <div className="mt-3 p-3 bg-green-50 rounded-xl">
                <audio controls className="w-full" src={testAudio} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}