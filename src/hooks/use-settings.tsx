'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

interface Settings {
  provider: 'local' | 'cloud';
  localModel: 'gemma' | 'voxtral';
  cloudModel: string;
  ttsProvider: 'piper' | 'voxtral';
  voice: string;
  lmstudioVoice: string;
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
  ttsProvider: 'piper',
  voice: 'en_GB-alan-medium',
  lmstudioVoice: 'en_us_aria',
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
          ttsProvider: data.ttsProvider || 'piper',
          voice: data.voice || 'en_GB-alan-medium',
          lmstudioVoice: data.lmstudioVoice || 'en_us_aria',
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