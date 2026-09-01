'use client';

import { useState, useEffect, createContext, useContext, ReactNode, useCallback, useMemo } from 'react';
import { normalizeTTSProvider, type TTSProvider } from '@/lib/tts-provider';
import type { ModelConnection } from '@/lib/model-connections';
import {
  createModelConnectionsRepository,
  type ModelConnectionsRepository,
} from '@/lib/model-connections-db';

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

interface ModelConnectionsContextType {
  enabled: boolean;
  isLoaded: boolean;
  connections: ModelConnection[];
  activeConnectionId?: string;
  error?: string;
  refresh: () => Promise<void>;
  save: (connection: ModelConnection, options?: { active?: boolean }) => Promise<void>;
  activate: (connectionId: string) => Promise<void>;
  deactivate: () => Promise<void>;
  deleteConnection: (connectionId: string) => Promise<void>;
}

const defaultModelConnectionsContextValue: ModelConnectionsContextType = {
  enabled: false,
  isLoaded: true,
  connections: [],
  refresh: async () => {},
  save: async () => {},
  activate: async () => {},
  deactivate: async () => {},
  deleteConnection: async () => {},
};

const ModelConnectionsContext = createContext<ModelConnectionsContextType>(defaultModelConnectionsContextValue);

export function useSettings() {
  return useContext(SettingsContext);
}

export function useModelConnections() {
  return useContext(ModelConnectionsContext);
}

export function ModelConnectionsProvider({
  children,
  enabled = false,
  repository,
}: {
  children: ReactNode;
  enabled?: boolean;
  repository?: ModelConnectionsRepository;
}) {
  const storage = useMemo(() => repository ?? createModelConnectionsRepository(), [repository]);
  const [connections, setConnections] = useState<ModelConnection[]>([]);
  const [activeConnectionId, setActiveConnectionId] = useState<string>();
  const [isLoaded, setIsLoaded] = useState(!enabled);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    if (!enabled) return;

    try {
      const restored = await storage.load();
      setConnections(restored.connections);
      setActiveConnectionId(restored.activeConnectionId);
      setError(undefined);
    } catch {
      setError('Model connection storage is unavailable.');
    } finally {
      setIsLoaded(true);
    }
  }, [enabled, storage]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(async (connection: ModelConnection, options: { active?: boolean } = {}) => {
    if (!enabled) return;

    setConnections((current) => {
      const withoutExisting = current.filter(({ id }) => id !== connection.id);
      return [...withoutExisting, connection];
    });

    try {
      await storage.save(connection, options);
      if (options.active) setActiveConnectionId(connection.id);
      setError(undefined);
    } catch {
      setError('Model connection was not saved.');
    }
  }, [enabled, storage]);

  const activate = useCallback(async (connectionId: string) => {
    if (!enabled) return;

    try {
      await storage.activate(connectionId);
      setActiveConnectionId(connectionId);
      setError(undefined);
    } catch {
      setError('Model connection could not be activated.');
    }
  }, [enabled, storage]);

  const deactivate = useCallback(async () => {
    if (!enabled) return;

    try {
      await storage.deactivate();
      setActiveConnectionId(undefined);
      setError(undefined);
    } catch {
      setError('Model connection could not be deactivated.');
    }
  }, [enabled, storage]);

  const deleteConnection = useCallback(async (connectionId: string) => {
    if (!enabled) return;

    try {
      await storage.delete(connectionId);
      setConnections((current) => current.filter(({ id }) => id !== connectionId));
      setActiveConnectionId((current) => current === connectionId ? undefined : current);
      setError(undefined);
    } catch {
      setError('Model connection could not be deleted.');
    }
  }, [enabled, storage]);

  const contextValue: ModelConnectionsContextType = {
    enabled,
    isLoaded,
    connections,
    activeConnectionId,
    error,
    refresh,
    save,
    activate,
    deactivate,
    deleteConnection,
  };

  return (
    <ModelConnectionsContext.Provider value={contextValue}>
      {children}
    </ModelConnectionsContext.Provider>
  );
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
