# Browser Execution Boundary Inventory

## Decision

The first browser-callable AI slice is **creator card generation**:

- `generateCardsAction` from `src/app/(app)/creator/page.tsx`
- `generate-cards-from-text` and its optional `classify-text-cefr` preflight

Phase 3 must replace both calls with the browser-only active-connection transport. A selected browser connection must never be passed to a server action, and this path has **no automatic server fallback**. If no validated active connection is available, or its browser request fails, the client must return an explicit unavailable result and preserve the selected connection.

## Current enablement policy

`NEXT_PUBLIC_MODEL_CONNECTIONS_ENABLED` remains default-off. Even an explicit `true` value cannot enable model connections until the complete first browser slice is migrated. `getModelConnectionsUiReadiness()` is the shared readiness gate; Phase 3 supplies the migration-ready signal only after selected-model execution is tested.

## Inventory

| Flow | `src/app/actions.ts` caller | UI/API caller | Execution and fallback |
|---|---|---|---|
| `generate-cards-from-text` | `generateCardsAction` | `src/app/(app)/creator/page.tsx` | First browser slice; browser-only, no server fallback. |
| `classify-text-cefr` | `generateCardsAction` | `src/app/(app)/creator/page.tsx` | First browser slice; browser-only, no server fallback. |
| `generate-quiz-questions` | `generateQuizQuestionAction` | `src/components/quiz-view.tsx` | Existing server-only legacy configuration; selected browser connection is unavailable. |
| `simulate-language-roleplay` | `startRoleplayAction`, `continueRoleplayAction` | `src/components/roleplay-view.tsx` | Existing server-only legacy configuration; selected browser connection is unavailable. |
| `evaluate-roleplay-performance` | `evaluateRoleplayAction` | `src/components/roleplay-view.tsx` | Existing server-only legacy configuration; selected browser connection is unavailable. |
| `explore-phrase` | `explorePhraseAction` | `src/components/phrase-explorer.tsx` | Existing server-only legacy configuration; selected browser connection is unavailable. |
| `text-to-speech` | `getTTSAudio` | `tts-button`, `reading-view`, `roleplay-view` | Voice-only server path; outside model connection scope. |
| `voice-practice` | `evaluateVoicePractice` | `src/app/api/voice-practice/route.ts` | Voice-only server path; outside model connection scope. |

The executable inventory is exported by `src/lib/model-connection-execution-policy.ts`. The server boundary test remains the guard against importing credential-bearing model connection code into server actions, API routes, or flows.
