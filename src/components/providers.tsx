'use client';

import { ReactNode } from 'react';
import { DecksProvider } from '@/contexts/decks-context';
import { SettingsModalProvider } from '@/components/settings-modal';
import { Toaster } from '@/components/ui/toaster';
import { SettingsModal } from '@/components/settings-modal';
import { ModelConnectionsProvider, SettingsProvider } from '@/hooks/use-settings';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <DecksProvider>
      <SettingsModalProvider>
        <SettingsProvider>
          <ModelConnectionsProvider>
            {children}
            <Toaster />
            <SettingsModal />
          </ModelConnectionsProvider>
        </SettingsProvider>
      </SettingsModalProvider>
    </DecksProvider>
  );
}
