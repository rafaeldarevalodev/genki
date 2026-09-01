export type ModelConnectionExecution =
  | 'first-browser-client-slice'
  | 'server-only-legacy'
  | 'voice-server-only';

export type ModelConnectionFallback =
  | 'browser-only-no-server-fallback'
  | 'legacy-server-only'
  | 'not-applicable';

export interface ModelConnectionExecutionInventoryEntry {
  flow: string;
  action: string;
  callers: string[];
  execution: ModelConnectionExecution;
  fallback: ModelConnectionFallback;
}

export const modelConnectionExecutionInventory: ModelConnectionExecutionInventoryEntry[] = [
  {
    flow: 'generate-cards-from-text',
    action: 'generateCardsAction',
    callers: ['src/app/(app)/creator/page.tsx'],
    execution: 'first-browser-client-slice',
    fallback: 'browser-only-no-server-fallback',
  },
  {
    flow: 'classify-text-cefr',
    action: 'generateCardsAction',
    callers: ['src/app/(app)/creator/page.tsx'],
    execution: 'first-browser-client-slice',
    fallback: 'browser-only-no-server-fallback',
  },
  {
    flow: 'generate-quiz-questions',
    action: 'generateQuizQuestionAction',
    callers: ['src/components/quiz-view.tsx'],
    execution: 'server-only-legacy',
    fallback: 'legacy-server-only',
  },
  {
    flow: 'simulate-language-roleplay',
    action: 'startRoleplayAction, continueRoleplayAction',
    callers: ['src/components/roleplay-view.tsx'],
    execution: 'server-only-legacy',
    fallback: 'legacy-server-only',
  },
  {
    flow: 'evaluate-roleplay-performance',
    action: 'evaluateRoleplayAction',
    callers: ['src/components/roleplay-view.tsx'],
    execution: 'server-only-legacy',
    fallback: 'legacy-server-only',
  },
  {
    flow: 'explore-phrase',
    action: 'explorePhraseAction',
    callers: ['src/components/phrase-explorer.tsx'],
    execution: 'server-only-legacy',
    fallback: 'legacy-server-only',
  },
  {
    flow: 'text-to-speech',
    action: 'getTTSAudio',
    callers: ['src/components/tts-button.tsx', 'src/components/reading-view.tsx', 'src/components/roleplay-view.tsx'],
    execution: 'voice-server-only',
    fallback: 'not-applicable',
  },
  {
    flow: 'voice-practice',
    action: 'evaluateVoicePractice',
    callers: ['src/app/api/voice-practice/route.ts'],
    execution: 'voice-server-only',
    fallback: 'not-applicable',
  },
];

export function getModelConnectionsUiReadiness(firstBrowserClientSliceMigrated: boolean) {
  if (!firstBrowserClientSliceMigrated) {
    return {
      enabled: false as const,
      reason: 'The browser model connection transport is not ready.',
    };
  }

  return { enabled: true as const };
}
