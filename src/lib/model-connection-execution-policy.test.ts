import { describe, expect, it } from 'vitest';
import {
  getModelConnectionsUiReadiness,
  modelConnectionExecutionInventory,
} from './model-connection-execution-policy';

describe('model connection execution policy', () => {
  it('selects creator card generation and roleplay as browser-callable slices without a server fallback', () => {
    const firstSlice = modelConnectionExecutionInventory.filter((entry) => entry.execution === 'first-browser-client-slice');

    expect(firstSlice).toEqual([
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
        flow: 'simulate-language-roleplay',
        action: 'startRoleplayAction, continueRoleplayAction',
        callers: ['src/components/roleplay-view.tsx'],
        execution: 'first-browser-client-slice',
        fallback: 'browser-only-no-server-fallback',
      },
      {
        flow: 'evaluate-roleplay-performance',
        action: 'evaluateRoleplayAction',
        callers: ['src/components/roleplay-view.tsx'],
        execution: 'first-browser-client-slice',
        fallback: 'browser-only-no-server-fallback',
      },
    ]);
  });

  it('keeps the UI unavailable until the complete first browser slice is migrated', () => {
    expect(getModelConnectionsUiReadiness(false)).toEqual({
      enabled: false,
      reason: 'The browser model connection transport is not ready.',
    });
    expect(getModelConnectionsUiReadiness(true)).toEqual({ enabled: true });
  });

  it('keeps unmigrated language flows on their existing server path', () => {
    expect(modelConnectionExecutionInventory.filter((entry) => entry.execution === 'server-only-legacy')).toEqual([
      {
        flow: 'generate-quiz-questions',
        action: 'generateQuizQuestionAction',
        callers: ['src/components/quiz-view.tsx'],
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
    ]);
  });
});
