# Tasks: Browser Model Connections

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 1,600–2,200 |
| 800-line budget risk | High |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | ask-always |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|---|---|---|---|
| 1 | Domain, IndexedDB, provider | PR 1 | Tests and rollback-safe flag; independent base. |
| 2 | Validation and accessible workspace | PR 2 | Depends on PR 1; tests included. |
| 3 | Client execution-boundary migration | PR 3 | Depends on PR 2 and entry-point decision. |
| 4 | E2E, retirement, docs | PR 4 | Depends on PR 3; enable only after proof. |

## Phase 1: Boundary and Persistence Foundation

- [x] 1.1 Inventory `src/ai/flows/*.ts` and their `src/app/actions.ts` callers; decide the first browser-callable AI path and an explicit server-only fallback/disable policy before enabling the flag.
- [x] 1.2 Create `src/lib/model-connections.ts` and unit tests for record/lifecycle types, HTTP(S) normalization, URL rejection, route disclosure, redaction, and status classification.
- [x] 1.3 Create `src/lib/model-connections-db.ts` and `model-connections-db.test.ts`: v0→v1 stores/indexes, future-version read-only failure, atomic record/active-ID lifecycle, restore, and storage-failure retention.
- [x] 1.4 Extend `src/hooks/use-settings.tsx` and `src/components/providers.tsx` with `ModelConnectionsProvider`, a disabled-by-default feature flag, lifecycle commands, and provider tests; retain Voice data/API boundary.

## Phase 2: Validation and Accessible Settings UI

- [ ] 2.1 Create `src/lib/model-connection-validator.ts` and tests for `/models`, manual model entry, `/chat/completions`, 15-second timeout, cancellation, stale-attempt suppression, and redacted auth/CORS/offline/incompatible results.
- [ ] 2.2 Create `src/components/model-connections-workspace.tsx` with active/no-active summary, route-labelled recommendations, saved rows, resumable editor, explicit Test then Activate, and no automatic fallback.
- [ ] 2.3 Modify `src/components/settings-modal.tsx` and `settings-modal.test.tsx` to use Radix Tabs/Dialog/AlertDialog, preserve Voice unchanged, and test keyboard flow, focus return/result announcement, delete-active no-active state, and narrow sticky actions.
- [ ] 2.4 Test mocked IndexedDB/fetch integration: discovery/probe/retry, active preservation on every failure, draft reload, unavailable storage, and no credential in UI diagnostics.

## Phase 3: Browser Execution Boundary

- [x] 3.1 Create `src/lib/model-connection-client.ts` with browser-only active-connection resolution and completion transport; test that credentials stay client-side and inactive/unvalidated records cannot execute.
- [x] 3.2 Migrate the approved entry-point slice from `src/ai/llm.ts`, affected `src/ai/flows/*.ts`, and `src/app/actions.ts` to the client transport; test selected-model execution and explicit unavailable behavior.
- [ ] 3.3 Remove LLM fields from `src/app/api/settings/route.ts` and related settings state/tests; retain the existing Voice contract and stop `.env.local` LLM reads/writes only after the migrated path passes.

## Phase 4: Release Proof and Documentation

- [ ] 4.1 Add `e2e/model-connections.spec.ts` plus runner configuration for add→test→activate→edit→deactivate→delete across reload, keyboard narrow recovery, and credential-redaction assertions.
- [ ] 4.2 Update `README.md` with browser-only/CORS/privacy limits, supported setup flow, rollback via feature flag, and no server persistence or encryption/retention claims.
