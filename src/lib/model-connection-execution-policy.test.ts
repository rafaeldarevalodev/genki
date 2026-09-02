import { describe, expect, it } from 'vitest';
import {
  getModelConnectionsUiReadiness,
  modelConnectionExecutionInventory,
} from './model-connection-execution-policy';

describe('model connection execution policy', () => {
  it('selects creator card generation, roleplay, quiz, and explore-phrase as browser-callable slices', () => {
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
        flow: 'generate-quiz-questions',
        action: 'generateQuizQuestions',
        callers: ['src/components/quiz-view.tsx'],
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
      {
        flow: 'explore-phrase',
        action: 'explorePhrase',
        callers: ['src/components/phrase-explorer.tsx'],
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

  it('includes quiz and explore-phrase in the first browser client slice', () => {
    const firstSlice = modelConnectionExecutionInventory.filter((entry) => entry.execution === 'first-browser-client-slice');

    expect(firstSlice).toContainEqual(
      expect.objectContaining({
        flow: 'generate-quiz-questions',
        action: 'generateQuizQuestions',
        execution: 'first-browser-client-slice',
        fallback: 'browser-only-no-server-fallback',
      }),
    );
    expect(firstSlice).toContainEqual(
      expect.objectContaining({
        flow: 'explore-phrase',
        action: 'explorePhrase',
        execution: 'first-browser-client-slice',
        fallback: 'browser-only-no-server-fallback',
      }),
    );
  });
});
