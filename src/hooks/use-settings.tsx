'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

interface Settings {
  provider: 'local' | 'cloud';
  localModel: 'gemma' | 'voxtral';
  cloudModel: string;
  ttsProvider: 'piper' | 'voxtral' | 'kokoro' | 'vibevoice' | 'vibevoice7b';
  voice: string;
  lmstudioVoice: string;
  kokoroVoice: string;
  vibevoiceVoice: string;
  vibevoice7bVoice: string;
  playbackSpeed: number;
}

interface SettingsContextType {
  settings: Settings;
  isLoaded: boolean;
  refresh: () => Promise<void>;
}

const defaultSettings: Settings = {
  provider: 'local',
  localModel: 'gemma',
  cloudModel: 'llama-3.3-70b-versatile',
  ttsProvider: 'kokoro',
  voice: 'en_GB-alan-medium',
  lmstudioVoice: 'en_us_aria',
  kokoroVoice: 'af_bella',
  vibevoiceVoice: 'en-Emma_woman',
  vibevoice7bVoice: 'en-Emma_woman',
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
          provider: data.provider || 'local',
          localModel: data.localModel || 'gemma',
          cloudModel: data.cloudModel || '',
          ttsProvider: data.ttsProvider || 'kokoro',
          voice: data.voice || 'en_GB-alan-medium',
          lmstudioVoice: data.lmstudioVoice || 'en_us_aria',
          kokoroVoice: data.kokoroVoice || 'af_bella',
          vibevoiceVoice: data.vibevoiceVoice || 'en-Emma_woman',
          vibevoice7bVoice: data.vibevoice7bVoice || 'en-Emma_woman',
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