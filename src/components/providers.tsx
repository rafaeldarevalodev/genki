'use client';

import { ReactNode } from 'react';
import { DecksProvider } from '@/contexts/decks-context';
import { SettingsModalProvider } from '@/components/settings-modal';
import { Toaster } from '@/components/ui/toaster';
import { SettingsModal } from '@/components/settings-modal';
import { ModelConnectionsProvider, SettingsProvider } from '@/hooks/use-settings';
import { getModelConnectionsUiReadiness } from '@/lib/model-connection-execution-policy';

export function isModelConnectionsFeatureEnabled(
  value = process.env.NEXT_PUBLIC_MODEL_CONNECTIONS_ENABLED,
  firstBrowserClientSliceMigrated = false,
) {
  return value === 'true' && getModelConnectionsUiReadiness(firstBrowserClientSliceMigrated).enabled;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <DecksProvider>
      <SettingsModalProvider>
        <SettingsProvider>
          <ModelConnectionsProvider enabled={isModelConnectionsFeatureEnabled()}>
            {children}
            <Toaster />
            <SettingsModal />
          </ModelConnectionsProvider>
        </SettingsProvider>
      </SettingsModalProvider>
    </DecksProvider>
  );
}
