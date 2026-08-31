'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { normalizeTTSProvider, type TTSProvider } from '@/lib/tts-provider';

interface Settings {
  provider: 'local' | 'cloud';
  localModel: 'gemma';
  cloudModel: string;
  ttsProvider: TTSProvider;
  kokoroVoice: string;
  f5ttsVoice: string;
  playbackSpeed: number;
}

interface SettingsContextType {
  settings: Settings;
  isLoaded: boolean;
  refresh: () => Promise<void>;
}

const defaultSettings: Settings = {
  provider: 'cloud',
  localModel: 'gemma',
  cloudModel: 'moonshotai/kimi-k2.6',
  ttsProvider: 'f5tts',
  kokoroVoice: 'af_bella',
  f5ttsVoice: 'en-Emma_woman',
  playbackSpeed: 1,
};

const defaultContextValue: SettingsContextType = {
  settings: defaultSettings,
  isLoaded: false,
  refresh: async () => {},
};

const SettingsContext = createContext<SettingsContextType>(defaultContextValue);

export function useSettings() {
  return useContext(SettingsContext);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings({
          provider: data.provider || 'cloud',
          localModel: 'gemma',
          cloudModel: data.cloudModel || 'moonshotai/kimi-k2.6',
          ttsProvider: normalizeTTSProvider(data.ttsProvider),
          kokoroVoice: data.kokoroVoice || 'af_bella',
          f5ttsVoice: data.f5ttsVoice || 'en-Emma_woman',
          playbackSpeed: data.playbackSpeed || 1,
        });
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    } finally {
      setIsLoaded(true);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const contextValue: SettingsContextType = {
    settings,
    isLoaded,
    refresh: fetchSettings,
  };

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
}
