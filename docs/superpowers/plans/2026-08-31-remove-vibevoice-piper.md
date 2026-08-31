# Remove VibeVoice and Piper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove VibeVoice and Piper so F5-TTS and Kokoro are Genki's only selectable and runnable text-to-speech providers, while safely migrating stale persisted settings and preserving live voice.

**Architecture:** Establish one shared provider contract with `f5tts` as the fallback for absent, invalid, Piper, and VibeVoice persisted values. Route all frontend, server-action, and Maya live-voice calls through that two-provider contract, with Maya immersive mode using the caller-selected retained provider rather than a VibeVoice-only branch. Delete retired tracked code and wiring only after replacement paths compile and test; delete ignored models and the external Hugging Face repository cache only after an operator validates startup and live voice.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Genkit/Zod, Vitest 4 with happy-dom, Python 3.11/FastAPI, Bash, Conda.

## Global Constraints

- Retain only `f5tts` and `kokoro` as selectable and runnable providers; use `f5tts` as the sole fallback for invalid or retired persisted provider values.
- Do not alter F5-TTS or Kokoro behavior, quality settings, ports, or retained assets beyond provider selection and routing.
- Preserve `reference_voices/`, F5-TTS assets, Kokoro assets, and all tracked model weights; there are no tracked model weights in this repository.
- Do not delete ignored runtime models or external caches until retained-provider startup and one retained live-voice path have succeeded.
- Remove all tracked VibeVoice/Piper application code, servers, setup/startup wiring, configuration, UI, and documentation references, excluding `docs/superpowers/**` because it intentionally records this approved removal work.
- Preserve the pre-existing user-owned `.atl/.skill-registry.cache.json` and `.atl/skill-registry.md` modifications. Do not stage, edit, revert, mention in commits, or include `.atl/**` in verification scope.
- Do not change package dependencies, lockfiles, Git history, or Git configuration. The `mlx-speech` Gitlink is a removal target, not a dependency update.
- Keep post-validation cache deletion out of tracked commits; it is an explicit, local, irreversible operator action.
- Current baseline: `npx vitest run` passes 5 tests. `npm run typecheck` currently fails before this change in `public/workers/audio-stream.worker.ts`, `src/workers/audio-stream.worker.ts`, `src/components/audio-player.test.tsx`, and `src/hooks/useLiveVoice.ts`; do not claim a clean typecheck unless those unrelated baseline failures are separately resolved.

---

## File Map

| Path | Responsibility after this change |
|---|---|
| `src/lib/tts-provider.ts` | Single source of truth for the supported provider union, fallback, and persisted-value normalization. |
| `src/lib/tts-provider.test.ts` | Unit coverage for supported values and stale Piper/VibeVoice migration. |
| `src/ai/llm.ts` | Builds F5-TTS or Kokoro endpoint configuration from normalized environment state. |
| `src/app/api/settings/route.ts` | Reads, normalizes, persists, and writes only retained TTS settings. |
| `src/app/api/settings/route.test.ts` | Route-level regression coverage for persisted retired-provider migration and retained settings responses. |
| `src/hooks/use-settings.tsx` | Exposes only retained provider and voice settings to client consumers. |
| `src/components/settings-modal.tsx` | Shows two provider choices and their retained voice controls; removes VibeVoice upload/local-storage UI. |
| `src/ai/flows/text-to-speech.ts` | Accepts and dispatches only F5-TTS or Kokoro speech requests. |
| `src/ai/flows/text-to-speech.test.ts` | Dispatch-level regression coverage for retired and retained provider inputs. |
| `src/ai/flows/generate-cards-from-text.ts` | Assigns generated cards only a retained-provider-compatible Kokoro voice ID. |
| `src/ai/flows/generate-cards-from-text.test.ts` | Verifies generated card voice IDs never use retired Piper IDs. |
| `src/app/actions.ts` | Normalizes caller-supplied provider values before invoking the TTS flow. |
| `src/app/actions.test.ts` | Server-action boundary coverage for provider normalization before flow invocation. |
| `src/components/{tts-button,reading-view,roleplay-view,voice-practice-view}.tsx` | Selects a voice only from F5-TTS or Kokoro settings. |
| `src/hooks/useLiveVoice.ts` | Sends Maya only a retained provider and matching voice. |
| `src/hooks/useLiveVoice.test.ts` | Unit coverage for translating loaded or stale client settings into a retained Maya selection. |
| `maya_live_server.py` | Streams F5-TTS or Kokoro for fast and immersive Maya requests; no `mlx-speech` import or VibeVoice/Piper path. |
| `tests/test_maya_live_server.py` | Standard-library Python unit coverage for fast/immersive retained-provider routing without starting services. |
| `genki.sh`, `setup.sh`, `environment.yml` | Start and set up only retained services/environments. |
| `tests/test_retired_service_lifecycle.sh` | Deterministic shell gate that rejects retired service names and ports in lifecycle scripts. |
| `README.md`, `QUICKSTART.md`, `GENKI-SETUP.md`, `reference_voices/README.md` | Document F5-TTS and Kokoro only. |
| `docs/INSTALL.legacy.md` | Delete because it is a Piper-specific legacy installation manual with stale retired-provider guidance. |
| `vibevoice7b_server.py`, `tts/server.py`, `scripts/setup-tts.sh`, `mlx-speech` | Delete as VibeVoice/Piper-only tracked implementation and Gitlink targets. |

## Provider Contract

```ts
// src/lib/tts-provider.ts
export const SUPPORTED_TTS_PROVIDERS = ['f5tts', 'kokoro'] as const;
export type TTSProvider = (typeof SUPPORTED_TTS_PROVIDERS)[number];
export const DEFAULT_TTS_PROVIDER: TTSProvider = 'f5tts';

export function normalizeTTSProvider(value: unknown): TTSProvider {
  return value === 'f5tts' || value === 'kokoro' ? value : DEFAULT_TTS_PROVIDER;
}
```

All provider-consuming interfaces use `TTSProvider`. `normalizeTTSProvider` maps missing, malformed, `piper`, and `vibevoice7b` values to `f5tts`; callers do not retain or branch on retired values.

### Task 1: Establish and Test the Retained Provider Contract

**Files:**
- Create: `src/lib/tts-provider.ts`
- Create: `src/lib/tts-provider.test.ts`
- Modify: `vitest.config.ts:6-15`
- Modify: `src/ai/llm.ts:29-139`

**Interfaces:**
- Produces: `TTSProvider`, `SUPPORTED_TTS_PROVIDERS`, `DEFAULT_TTS_PROVIDER`, and `normalizeTTSProvider(value: unknown): TTSProvider`.
- Consumes: `.env.local` values read by the existing `reloadEnv()` function.
- Guarantees: `getTTSConfig(): TTSConfig` returns only `{ provider: 'f5tts' | 'kokoro', endpoint: string, voice: string }`.

- [ ] **Step 1: Write the failing provider-contract tests**

Create `src/lib/tts-provider.test.ts` with the complete migration matrix:

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TTS_PROVIDER,
  SUPPORTED_TTS_PROVIDERS,
  normalizeTTSProvider,
} from './tts-provider';

describe('TTS provider contract', () => {
  it.each(['f5tts', 'kokoro'])('retains supported provider %s', (provider) => {
    expect(normalizeTTSProvider(provider)).toBe(provider);
  });

  it.each([undefined, '', 'piper', 'vibevoice7b', 'unknown', null])(
    'migrates stale provider %p to F5-TTS',
    (provider) => {
      expect(normalizeTTSProvider(provider)).toBe(DEFAULT_TTS_PROVIDER);
    }
  );

  it('exports exactly the two selectable providers', () => {
    expect(SUPPORTED_TTS_PROVIDERS).toEqual(['f5tts', 'kokoro']);
  });
});
```

- [ ] **Step 2: Expand the existing Vitest include pattern and run the test to verify it fails**

Change `vitest.config.ts` `test.include` from `['src/components/**/*.test.{ts,tsx}']` to `['src/**/*.test.{ts,tsx}']`, then run:

```bash
npx vitest run src/lib/tts-provider.test.ts
```

Expected: FAIL because `./tts-provider` does not exist.

- [ ] **Step 3: Implement the shared contract and normalize server configuration**

Create `src/lib/tts-provider.ts` exactly as specified in the Provider Contract. In `src/ai/llm.ts`, import `TTSProvider` and `normalizeTTSProvider` from that module, remove the local four-provider union and `getVibeVoice7BConfig`, and make `getTTSConfig()`:

```ts
const provider = normalizeTTSProvider(env.TTS_PROVIDER);
return provider === 'kokoro' ? getKokoroConfig() : getF5TTSConfig();
```

Keep existing F5-TTS endpoint and voice defaults (`http://localhost:8093`, `en-Giuseppe_man`) and Kokoro defaults (`http://localhost:8880`, `af_bella`) unchanged.

- [ ] **Step 4: Run focused and complete JavaScript tests**

Run:

```bash
npx vitest run src/lib/tts-provider.test.ts
npx vitest run
```

Expected: the new contract test passes; the complete suite passes with the existing audio-player tests plus the new test.

- [ ] **Step 5: Review the uncommitted provider-contract worktree checkpoint**

```bash
git diff --check -- vitest.config.ts src/lib/tts-provider.ts src/lib/tts-provider.test.ts src/ai/llm.ts
git diff --name-only -- vitest.config.ts src/lib/tts-provider.ts src/lib/tts-provider.test.ts src/ai/llm.ts
git status --short
```

Expected: no whitespace errors; the relevant diff names only `vitest.config.ts`, `src/lib/tts-provider.ts`, `src/lib/tts-provider.test.ts`, and `src/ai/llm.ts`; status does not show `.atl/**`, lockfile, or model/cache paths as part of this work. Leave the checkpoint uncommitted and unstaged for user review.

### Task 2: Migrate Persisted Settings and Remove Retired Settings UI

**Files:**
- Modify: `src/app/api/settings/route.ts:7-98`
- Create: `src/app/api/settings/route.test.ts`
- Modify: `src/hooks/use-settings.tsx:5-89`
- Modify: `src/components/settings-modal.tsx:39-548`

**Interfaces:**
- Consumes: `normalizeTTSProvider(value: unknown): TTSProvider` and `DEFAULT_TTS_PROVIDER` from `src/lib/tts-provider.ts`.
- Produces: API `GET /api/settings` and `POST /api/settings` responses whose `ttsProvider` is always `TTSProvider`; persisted `TTS_PROVIDER` is rewritten to `f5tts` when it was Piper, VibeVoice, empty, or unknown.
- Produces: settings object fields `ttsProvider: TTSProvider`, `kokoroVoice: string`, `f5ttsVoice: string`, and `playbackSpeed: number`; removes `voice` and `vibevoice7bVoice` fields.
- Test boundary: `src/app/api/settings/route.test.ts` calls the real exported `GET` and `POST` handlers. It mocks only Node's `fs` module, because the route's `.env.local` read/write is its external persistence boundary; assertions observe JSON and the fake file contents, never mock call counts.

- [ ] **Step 1: Write the failing settings-route migration tests**

Create `src/app/api/settings/route.test.ts`. The test-local `fs` fake isolates `.env.local` without changing the developer's real settings file. Each expected value is a literal contract value, not derived with `normalizeTTSProvider`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const envFile = vi.hoisted(() => ({ contents: '', writes: [] as string[] }));

vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(() => envFile.contents),
  writeFileSync: vi.fn((_path: string, contents: string) => {
    envFile.contents = contents;
    envFile.writes.push(contents);
  }),
}));

import { GET, POST } from './route';

describe('/api/settings retired TTS migration', () => {
  beforeEach(() => {
    envFile.contents = '';
    envFile.writes = [];
  });

  it('migrates and persists a stale VibeVoice provider during GET', async () => {
    envFile.contents = [
      'TTS_PROVIDER=vibevoice7b',
      'TTS_KOKORO_VOICE=af_bella',
      'TTS_F5TTS_VOICE=en-Emma_woman',
    ].join('\n');

    const response = await GET();
    const body = await response.json();

    expect(body.ttsProvider).toBe('f5tts');
    expect(envFile.contents).toContain('TTS_PROVIDER=f5tts');
  });

  it('refuses a retired provider value during POST', async () => {
    const response = await POST(new NextRequest('http://localhost/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ttsProvider: 'vibevoice7b',
        voice: 'en_GB-alan-medium',
        vibevoice7bVoice: 'en-Emma_woman',
      }),
    }));

    expect(await response.json()).toEqual({ success: true });
    expect(envFile.contents).toContain('TTS_PROVIDER=f5tts');
    expect(envFile.contents).not.toContain('TTS_VOICE=');
    expect(envFile.contents).not.toContain('TTS_VIBEVOICE7B_VOICE=');
  });

  it('returns only retained TTS voice fields during GET', async () => {
    envFile.contents = [
      'TTS_PROVIDER=kokoro',
      'TTS_KOKORO_VOICE=af_bella',
      'TTS_F5TTS_VOICE=en-Emma_woman',
    ].join('\n');

    const body = await (await GET()).json();

    expect(body).toMatchObject({
      ttsProvider: 'kokoro',
      kokoroVoice: 'af_bella',
      f5ttsVoice: 'en-Emma_woman',
    });
    expect(body).not.toHaveProperty('voice');
    expect(body).not.toHaveProperty('vibevoice7bVoice');
  });
});
```

- [ ] **Step 2: Run the settings-route test to verify RED**

Run:

```bash
npx vitest run src/app/api/settings/route.test.ts
```

Expected: FAIL with the first test receiving `"vibevoice7b"` instead of `"f5tts"`, the POST test persisting `TTS_PROVIDER=vibevoice7b` and retired voice keys, and the final GET test exposing `voice` and `vibevoice7bVoice`. These are behavior failures in the existing route, not test setup errors.

- [ ] **Step 3: Implement the minimal settings-route migration**

In `src/app/api/settings/route.ts`:

1. Import `DEFAULT_TTS_PROVIDER`, `TTSProvider`, and `normalizeTTSProvider`.
2. Replace the four-provider `SettingsData.ttsProvider` union with `TTSProvider`; remove `voice` and `vibevoice7bVoice` from `SettingsData`.
3. In `GET`, derive `const ttsProvider = normalizeTTSProvider(env.TTS_PROVIDER)`. If `env.TTS_PROVIDER !== ttsProvider`, set `env.TTS_PROVIDER = ttsProvider` and call the existing `writeEnvFile(env)` before returning JSON. This makes a stale persisted selection a one-time on-read migration instead of merely a UI fallback.
4. Return `ttsProvider`, `kokoroVoice`, `f5ttsVoice`, and `playbackSpeed`; do not return Piper/VibeVoice voice fields.
5. In `POST`, assign `env.TTS_PROVIDER = normalizeTTSProvider(data.ttsProvider ?? DEFAULT_TTS_PROVIDER)`, write only `TTS_KOKORO_VOICE`, `TTS_F5TTS_VOICE`, and `TTS_PLAYBACK_SPEED` when supplied, and never write `TTS_ENDPOINT`, `TTS_VOICE`, or `TTS_VIBEVOICE7B_*`.

- [ ] **Step 4: Run the settings-route migration test to verify GREEN**

Run:

```bash
npx vitest run src/app/api/settings/route.test.ts
```

Expected: PASS. The three route tests prove GET migrates and persists `vibevoice7b` as `f5tts`, POST persists `f5tts` rather than a retired submitted provider and does not write retired voice keys, and GET omits both retired response fields.

- [ ] **Step 5: Simplify client settings state and modal controls**

In `src/hooks/use-settings.tsx`, import `TTSProvider` and `normalizeTTSProvider`; replace the four-value union with `TTSProvider`, remove `voice` and `vibevoice7bVoice`, and normalize `data.ttsProvider` when fetching settings.

In `src/components/settings-modal.tsx`:

1. Use `TTSProvider` for `ttsProvider` state and normalize the API value before storing it.
2. Remove `selectedVoice`, `selectedVibeVoice7B`, `userVoices7B`, every `vibevoice7b_user_voices` localStorage read/write, the voice upload control, the Piper list and panel, and the VibeVoice list and panel.
3. Keep the current F5 reference-voice IDs as a dedicated `f5ttsVoices` array rather than aliasing a VibeVoice-named array.
4. Keep the Kokoro list unchanged.
5. Make `ttsProviders` contain only `{ id: 'f5tts', ... }` and `{ id: 'kokoro', ... }`.
6. Save only `ttsProvider`, `kokoroVoice`, `f5ttsVoice`, and `playbackSpeed` with the existing LLM settings.
7. Keep `testTtsVoice` only for `f5tts` (`http://localhost:8093/tts`, `{ text, voice }`) and `kokoro` (`http://localhost:8880/v1/audio/speech`, `{ input, voice, speed: '1.0' }`).

- [ ] **Step 6: Run focused and complete automated verification**

Run:

```bash
npx vitest run src/lib/tts-provider.test.ts
npx vitest run src/app/api/settings/route.test.ts
npx vitest run
npm run typecheck
```

Expected: the provider and settings-route tests PASS, and the complete Vitest suite PASS. Typecheck still reports only the documented baseline failures; it must not report a provider-union, removed-field, settings-route, settings-hook, or settings-modal error.

- [ ] **Step 7: Review the uncommitted settings-migration worktree checkpoint**

```bash
git diff --check -- src/app/api/settings/route.ts src/app/api/settings/route.test.ts src/hooks/use-settings.tsx src/components/settings-modal.tsx
git diff --name-only -- src/app/api/settings/route.ts src/app/api/settings/route.test.ts src/hooks/use-settings.tsx src/components/settings-modal.tsx
git status --short
```

Expected: no whitespace errors; the relevant diff names only the settings route, settings-route test, settings hook, and settings modal; `.env.local` remains untracked and unstaged. Leave the checkpoint uncommitted and unstaged for user review.

### Task 3: Remove Retired Playback Dispatch and Generate Retained Voice IDs

**Files:**
- Modify: `src/ai/flows/text-to-speech.ts:18-206`
- Create: `src/ai/flows/text-to-speech.test.ts`
- Modify: `src/ai/flows/generate-cards-from-text.ts:27-40,165-176`
- Create: `src/ai/flows/generate-cards-from-text.test.ts`
- Modify: `src/app/actions.ts:136-168`
- Create: `src/app/actions.test.ts`
- Modify: `src/components/tts-button.tsx:48-55`
- Modify: `src/components/reading-view.tsx:33-40`
- Modify: `src/components/roleplay-view.tsx:130-138`
- Modify: `src/components/voice-practice-view.tsx:151-203`

**Interfaces:**
- Consumes: `TTSProvider` and `normalizeTTSProvider` from `src/lib/tts-provider.ts`.
- Produces: `TextToSpeechInput.provider?: unknown`; `textToSpeech(input: TextToSpeechInput)` normalizes runtime provider input before retained dispatch. `getTTSAudio(text: string, voice?: string, provider?: unknown): Promise<{ media: string } | null>` normalizes arbitrary server-action callers before invoking that flow.
- Produces: generated `Card.voice` values selected from retained `KOKORO_VOICES`, never Piper IDs.

- [ ] **Step 1: Write the failing playback-dispatch tests**

Create `src/ai/flows/text-to-speech.test.ts`. The mocked `getTTSConfig` and `fetch` isolate only the flow's configuration and HTTP boundaries; each assertion observes the actual request shape produced by `textToSpeech`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getTTSConfig = vi.hoisted(() => vi.fn());
const getF5TTSConfig = vi.hoisted(() => vi.fn());
const getKokoroConfig = vi.hoisted(() => vi.fn());

vi.mock('@/ai/llm', () => ({ getTTSConfig, getF5TTSConfig, getKokoroConfig }));

import { textToSpeech } from './text-to-speech';

describe('textToSpeech provider dispatch', () => {
  beforeEach(() => {
    getTTSConfig.mockReturnValue({
      provider: 'kokoro',
      endpoint: 'http://configured-provider.test',
      voice: 'af_bella',
    });
    getF5TTSConfig.mockReturnValue({ provider: 'f5tts', endpoint: 'http://f5.test', voice: 'en-Emma_woman' });
    getKokoroConfig.mockReturnValue({ provider: 'kokoro', endpoint: 'http://kokoro.test', voice: 'af_bella' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array([1]))));
  });

  it.each(['piper', 'vibevoice7b'])('normalizes retired %s input to F5-TTS dispatch', async (provider) => {
    await textToSpeech({ text: 'Hello', provider });

    expect(fetch).toHaveBeenCalledWith('http://f5.test/tts', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ text: 'Hello.', voice: 'en-Emma_woman' }),
    }));
  });

  it('keeps a Kokoro input on the Kokoro dispatch path', async () => {
    await textToSpeech({ text: 'Hello.', provider: 'kokoro' });

    expect(fetch).toHaveBeenCalledWith('http://kokoro.test/v1/audio/speech', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ input: 'Hello.', voice: 'af_bella', speed: 1.0 }),
    }));
  });
});
```

- [ ] **Step 2: Run the playback-dispatch test to verify RED**

Run:

```bash
npx vitest run src/ai/flows/text-to-speech.test.ts
```

Expected: FAIL. Before the change, `piper` uses `http://configured-provider.test/tts` from the active configuration and `vibevoice7b` uses that configured endpoint's retired request shape; neither produces the literal F5-TTS request to `http://f5.test/tts`. The Kokoro test also fails because the current flow ignores the dedicated Kokoro configuration. These failures prove the inputs are not normalized into the correct retained dispatch configuration.

- [ ] **Step 3: Write the failing server-action boundary test**

Create `src/app/actions.test.ts`. Mocking `textToSpeech` is necessary because it is the action's external flow boundary; the assertion is the action's observable payload contract, not a mock behavior assertion:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const textToSpeech = vi.hoisted(() => vi.fn());

vi.mock('@/ai/flows/text-to-speech', () => ({ textToSpeech }));

import { getTTSAudio } from './actions';

describe('getTTSAudio provider boundary', () => {
  beforeEach(() => {
    textToSpeech.mockReset();
    textToSpeech.mockResolvedValue({ media: 'data:audio/wav;base64,AA==' });
  });

  it.each(['piper', 'vibevoice7b'])('normalizes retired %s before invoking textToSpeech', async (provider) => {
    await getTTSAudio('Hello', 'en-Emma_woman', provider);

    expect(textToSpeech).toHaveBeenCalledWith({
      text: 'Hello',
      voice: 'en-Emma_woman',
      provider: 'f5tts',
    });
  });
});
```

- [ ] **Step 4: Run the server-action boundary test to verify RED**

Run:

```bash
npx vitest run src/app/actions.test.ts
```

Expected: FAIL because the existing action forwards `piper` and `vibevoice7b` unchanged instead of passing the literal `f5tts` fallback to `textToSpeech`.

- [ ] **Step 5: Write the failing generated-card voice regression test**

Create `src/ai/flows/generate-cards-from-text.test.ts` with a mocked LLM response and controlled random branches:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/ai/llm', () => ({
  callAIWithContext: vi.fn().mockResolvedValue(JSON.stringify([
    {
      front: 'Hello',
      back: 'Hola',
      ipa: '/həˈloʊ/',
      spanish_phonetic: 'jelóu',
      explanation: 'Saludo',
      category: 'filler',
    },
  ])),
}));

import { generateCardsFromText } from './generate-cards-from-text';

describe('generateCardsFromText voice assignment', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([0, 0.99])('assigns a retained Kokoro voice when random is %s', async (random) => {
    vi.spyOn(Math, 'random').mockReturnValue(random);
    const result = await generateCardsFromText({ text: 'Hello' });
    expect(result.cards[0].voice).toMatch(/^(af_|am_|bm_)/);
    expect(result.cards[0].voice).not.toMatch(/^(en_GB|en_US|es_MX)/);
  });
});
```

Run:

```bash
npx vitest run src/ai/flows/generate-cards-from-text.test.ts
```

Expected: FAIL while `getVoiceForCard()` can choose `PIPER_VOICES`.

- [ ] **Step 6: Restrict the Genkit flow and server action to the shared contract**

In `src/ai/flows/text-to-speech.ts`, import `getF5TTSConfig`, `getKokoroConfig`, and `normalizeTTSProvider`; change `provider` in `TextToSpeechInputSchema` to `z.unknown().optional()` so the runtime flow boundary can migrate stale callers, remove `referenceAudioData`, `textToSpeechPiper`, and `textToSpeechVibeVoice7B`, then set `const provider = normalizeTTSProvider(input?.provider ?? getTTSConfig().provider)` and select `const ttsConfig = provider === 'f5tts' ? getF5TTSConfig() : getKokoroConfig()`. Change the retained helper signatures to `textToSpeechF5TTS(text: string, voice: string, endpoint: string)` and `textToSpeechKokoro(text: string, voice: string, endpoint: string)`; remove their internal `getTTSConfig()` reads and pass `ttsConfig.endpoint` into the selected helper. This ensures a retired caller input uses the F5-TTS endpoint and voice even when the persisted active setting is Kokoro. Preserve punctuation normalization and both retained HTTP request shapes.

In `src/app/actions.ts`, import `normalizeTTSProvider`, change the `provider` argument to `unknown`, set `const validProvider = normalizeTTSProvider(provider)`, and remove all browser-only VibeVoice custom-voice/localStorage code and `referenceAudioData` from the flow input.

- [ ] **Step 7: Ensure generated and interactive playback voices are retained-provider-compatible**

In `src/ai/flows/generate-cards-from-text.ts`, delete `PIPER_VOICES` and make `getVoiceForCard()` select from `KOKORO_VOICES` on every invocation. Do not change card schema or existing persisted cards; `Card.voice` is optional and currently not consumed by the playback components.

In `tts-button.tsx`, `reading-view.tsx`, and `roleplay-view.tsx`, replace the three/four-provider ternary with two branches: Kokoro selects `settings.kokoroVoice`; otherwise select `settings.f5ttsVoice`.

In `voice-practice-view.tsx`, default to `f5tts`; remove the VibeVoice branch and the Piper final branch; use the existing F5 endpoint/body for `f5tts` and the existing Kokoro endpoint/body for `kokoro`.

- [ ] **Step 8: Run the focused RED-GREEN tests and the complete suite**

Run:

```bash
npx vitest run src/ai/flows/generate-cards-from-text.test.ts
npx vitest run src/ai/flows/text-to-speech.test.ts
npx vitest run src/app/actions.test.ts
npx vitest run
npm run typecheck
```

Expected: the generated-card, dispatch, and action-boundary tests PASS; the complete Vitest suite PASS. Typecheck reports only the Global Constraints baseline failures, with no errors from the modified flow, action, or playback components.

- [ ] **Step 9: Review the uncommitted browser and server playback worktree checkpoint**

```bash
git diff --check -- src/ai/flows/text-to-speech.ts src/ai/flows/text-to-speech.test.ts src/ai/flows/generate-cards-from-text.ts src/ai/flows/generate-cards-from-text.test.ts src/app/actions.ts src/app/actions.test.ts src/components/tts-button.tsx src/components/reading-view.tsx src/components/roleplay-view.tsx src/components/voice-practice-view.tsx
git diff --name-only -- src/ai/flows/text-to-speech.ts src/ai/flows/text-to-speech.test.ts src/ai/flows/generate-cards-from-text.ts src/ai/flows/generate-cards-from-text.test.ts src/app/actions.ts src/app/actions.test.ts src/components/tts-button.tsx src/components/reading-view.tsx src/components/roleplay-view.tsx src/components/voice-practice-view.tsx
git status --short
```

Expected: no whitespace errors; the relevant diff names only the listed flow, action, component, and regression-test paths. Leave the checkpoint uncommitted and unstaged for user review.

### Task 4: Route Maya Fast and Immersive Voice Through Retained Providers

**Files:**
- Modify: `src/hooks/useLiveVoice.ts:50-98,287-299`
- Create: `src/hooks/useLiveVoice.test.ts`
- Modify: `maya_live_server.py:1-245,640-1117,1321-1346`
- Create: `tests/test_maya_live_server.py`
- Modify: `src/app/api/maya/conversation/route.ts:15-22`

**Interfaces:**
- Consumes: `settings.ttsProvider: TTSProvider`, `settings.kokoroVoice`, and `settings.f5ttsVoice`.
- Produces: Maya conversation requests with `tts_provider` equal to `f5tts` or `kokoro` and a voice compatible with that provider.
- Produces: `getMayaTTSSelection(settings, settingsLoaded): { provider: TTSProvider; voice: string }`, a pure client-settings boundary used by the hook and its unit test.
- Produces: `stream_tts(text, mode, signal, tts_provider, tts_voice, reference_audio_path, reference_text, session_id)` that dispatches F5-TTS for `f5tts` and `_stream_kokoro_fallback` for `kokoro`, regardless of `mode`.
- Test boundary: `tests/test_maya_live_server.py` imports the real `stream_tts` and replaces only dispatch generators plus the retired model-cache probe. It makes no HTTP calls, model loads, subprocesses, or service starts; the yielded route markers are the observable behavior of the real router.

- [ ] **Step 1: Write the failing Python Maya routing tests**

Create `tests/test_maya_live_server.py` using only Python's existing standard-library `unittest` and `unittest.mock`; do not add a Python test dependency or configuration:

```python
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import maya_live_server as maya


class StreamTTSRoutingTests(unittest.IsolatedAsyncioTestCase):
    async def test_immersive_f5_request_uses_f5_dispatch(self):
        async def f5(*args, **kwargs):
            yield {"route": "f5"}

        async def kokoro(*args, **kwargs):
            yield {"route": "kokoro"}

        async def retired(*args, **kwargs):
            yield {"route": "retired"}

        with (
            patch.object(maya, "model_cache", SimpleNamespace(load_vibevoice=lambda: object())),
            patch.object(maya, "_stream_f5tts", f5),
            patch.object(maya, "_stream_kokoro_fallback", kokoro),
            patch.object(maya, "_stream_vibevoice", retired, create=True),
        ):
            chunks = [chunk async for chunk in maya.stream_tts(
                "Hello", "immersive", tts_provider="f5tts", tts_voice="en-Emma_woman"
            )]

        self.assertEqual(chunks, [{"route": "f5"}])

    async def test_immersive_kokoro_request_preserves_kokoro_dispatch_and_voice(self):
        kokoro_calls = []

        async def f5(*args, **kwargs):
            yield {"route": "f5"}

        async def kokoro(*args, **kwargs):
            kokoro_calls.append((args, kwargs))
            yield {"route": "kokoro"}

        async def retired(*args, **kwargs):
            yield {"route": "retired"}

        with (
            patch.object(maya, "model_cache", SimpleNamespace(load_vibevoice=lambda: object())),
            patch.object(maya, "_stream_f5tts", f5),
            patch.object(maya, "_stream_kokoro_fallback", kokoro),
            patch.object(maya, "_stream_vibevoice", retired, create=True),
        ):
            chunks = [chunk async for chunk in maya.stream_tts(
                "Hello", "immersive", tts_provider="kokoro", tts_voice="af_sarah"
            )]

        self.assertEqual(chunks, [{"route": "kokoro"}])
        self.assertEqual(kokoro_calls, [(("Hello", None, ""), {"voice": "af_sarah"})])


if __name__ == "__main__":
    unittest.main()
```

The `retired` fake makes the current immersive override deterministically observable during RED. The tests assert the route yielded by real `stream_tts`; the retained F5/Kokoro generators are isolated because they otherwise load models or make HTTP calls.

- [ ] **Step 2: Run the Maya routing tests to verify RED**

Run:

```bash
conda run -n genki python -m unittest discover -s tests -p 'test_maya_live_server.py' -v
```

Expected: both tests FAIL with `{'route': 'retired'}` instead of the requested F5-TTS or Kokoro route. The deterministic fake proves that `mode == "immersive"` currently overrides the caller's retained-provider selection; no service is started.

- [ ] **Step 3: Write the failing live-voice selection test**

Create `src/hooks/useLiveVoice.test.ts` before changing the hook. It tests a pure exported selection helper, avoiding microphone, browser, and service setup:

```ts
import { describe, expect, it } from 'vitest';
import { getMayaTTSSelection } from './useLiveVoice';

describe('getMayaTTSSelection', () => {
  it.each(['piper', 'vibevoice7b', 'unknown'])('falls back from stale %s settings to F5-TTS', (ttsProvider) => {
    expect(getMayaTTSSelection({
      ttsProvider,
      kokoroVoice: 'af_sarah',
      f5ttsVoice: 'en-Davis_man',
    }, true)).toEqual({ provider: 'f5tts', voice: 'en-Davis_man' });
  });

  it('keeps the selected Kokoro voice', () => {
    expect(getMayaTTSSelection({
      ttsProvider: 'kokoro',
      kokoroVoice: 'af_sarah',
      f5ttsVoice: 'en-Davis_man',
    }, true)).toEqual({ provider: 'kokoro', voice: 'af_sarah' });
  });

  it('uses the unloaded-settings F5-TTS default', () => {
    expect(getMayaTTSSelection(null, false)).toEqual({ provider: 'f5tts', voice: 'en-Emma_woman' });
  });
});
```

- [ ] **Step 4: Run the hook selection test to verify RED**

Run:

```bash
npx vitest run src/hooks/useLiveVoice.test.ts
```

Expected: FAIL because `getMayaTTSSelection` does not exist yet. The requested API is deliberately pure so its failure is independent of `MediaRecorder`, React effects, or a running Maya service.

- [ ] **Step 5: Remove retired provider selection from the live-voice hook**

In `src/hooks/useLiveVoice.ts`, export `getMayaTTSSelection(settings, settingsLoaded)`. Its parameter is the minimal structural settings shape used above: `ttsProvider?: unknown`, `kokoroVoice?: string`, and `f5ttsVoice?: string`; it returns `{ provider: TTSProvider, voice: string }`. Return `{ provider: 'kokoro', voice: settings.kokoroVoice || 'af_bella' }` only for a loaded Kokoro setting; return `{ provider: 'f5tts', voice: settings?.f5ttsVoice || 'en-Emma_woman' }` for unloaded, missing, stale, and unknown states. Replace the internal `getTTSVoice` callback with this helper so the real hook sends the tested selection.

Also remove the unused `MAYA_VOICE_STORAGE_KEY`, `DEFAULT_MAYA_VOICE`, `setMayaVoice` public return member, and its invalid `setMayaVoiceId` call. This removal fixes the existing undefined identifier in this file while eliminating retired Maya voice persistence.

- [ ] **Step 6: Remove the VibeVoice model and HTTP paths from Maya**

In `maya_live_server.py`:

1. Remove `MLX_SPEECH_DIR`, `sys` if then unused, `ModelCache.vibevoice_model`, `ModelCache.load_vibevoice`, `_stream_vibevoice`, and `_stream_vibevoice_http`.
2. Remove `_stream_piper_http`.
3. Replace the `mode == "immersive"` VibeVoice override in `stream_tts()` with normal retained-provider dispatch. `mode` remains accepted in the API for compatibility but must not force a provider.
4. Retain the F5-TTS path and its existing Kokoro fallback; retain explicit Kokoro dispatch. For any invalid value received from an older client, log the value and use the existing F5-TTS default path.
5. Update the pipeline/module comments and `VoiceConversationRequest.tts_provider` comment to name only F5-TTS and Kokoro.
6. In `main()`, make `--preload` load F5-TTS and Whisper only.

- [ ] **Step 7: Keep the Next.js proxy’s fallback coherent**

In `src/app/api/maya/conversation/route.ts`, retain its default `tts_provider: 'f5tts'` and `tts_voice: 'en-Emma_woman'`; add no retired-provider fallback or translation. The client hook is responsible for sending a supported provider, and Python retains an F5 fallback for old external callers.

- [ ] **Step 8: Run the hook and Python routing tests plus deterministic syntax checks to verify GREEN**

Run:

```bash
npx vitest run src/hooks/useLiveVoice.test.ts
conda run -n genki python -m unittest discover -s tests -p 'test_maya_live_server.py' -v
conda run -n genki python -m py_compile maya_live_server.py
git grep -n -i -E 'vibevoice|piper|mlx-speech' -- src maya_live_server.py
```

Expected: the hook selection test and both Python routing tests PASS without starting a service; `py_compile` exits 0. The `git grep` command exits 1 and prints no matches for those application paths.

- [ ] **Step 9: Verify retained Maya routing after services are started**

With F5-TTS, Kokoro, and Maya running, execute:

```bash
curl -fsS http://localhost:8092/health
```

Expected: JSON includes `"status":"ready"` and `"service":"maya-live-voice"`; it must not start, require, or report a listener on ports `8080` or `8091`.

In the browser, select F5-TTS in Settings, enter Maya Voice mode, perform one fast conversation and one immersive conversation, then repeat one fast conversation with Kokoro selected. Expected: all three conversations produce Maya audio; Maya logs identify F5-TTS or Kokoro only; no VibeVoice load, HTTP request, or Piper request appears.

- [ ] **Step 10: Review the uncommitted Maya routing worktree checkpoint**

```bash
git diff --check -- src/hooks/useLiveVoice.ts src/hooks/useLiveVoice.test.ts src/app/api/maya/conversation/route.ts maya_live_server.py tests/test_maya_live_server.py
git diff --name-only -- src/hooks/useLiveVoice.ts src/hooks/useLiveVoice.test.ts src/app/api/maya/conversation/route.ts maya_live_server.py tests/test_maya_live_server.py
git status --short
```

Expected: no whitespace errors; the relevant diff names only the live-voice hook and test, Maya proxy route, Maya server, and Python routing test. Leave the checkpoint uncommitted and unstaged for user review, so live-voice routing can be reviewed separately from server and documentation deletions.

### Task 5: Delete Retired Tracked Code, Services, Gitlink, and Documentation

**Files:**
- Delete: `vibevoice7b_server.py`
- Delete: `tts/server.py`
- Delete: `scripts/setup-tts.sh`
- Delete: `mlx-speech` Gitlink
- Delete: `docs/INSTALL.legacy.md`
- Create: `tests/test_retired_service_lifecycle.sh`
- Modify: `genki.sh:8-205`
- Modify: `setup.sh:41-201`
- Modify: `environment.yml:1-53`
- Modify: `README.md:20-659`
- Modify: `QUICKSTART.md:71-80`
- Modify: `GENKI-SETUP.md:156-196`
- Modify: `reference_voices/README.md:14-75`

**Interfaces:**
- Produces: `./genki.sh start|stop|status|restart` manages only Next.js, Kokoro, F5-TTS, Maya Live Voice, and Voice Eval.
- Produces: setup documentation and `environment.yml` with no Piper, VibeVoice, or `vibevoice7b` environment instructions.
- Guarantees: no tracked application/documentation path outside `docs/superpowers/**` references retired providers or `mlx-speech`.
- Test boundary: `tests/test_retired_service_lifecycle.sh` statically checks the two lifecycle scripts for retired service identifiers and retired listener ports, then runs Bash syntax validation. This is intentionally a deterministic source-level deletion gate; it does not run `start` or `stop` and therefore cannot kill developer processes.

- [ ] **Step 1: Write the failing retired-service lifecycle gate**

Create `tests/test_retired_service_lifecycle.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

retired_matches=$(grep -nEi \
  'PIPER_PORT|VIBEVOICE7B_PORT|start_piper|start_vibevoice7b|Piper TTS|VibeVoice|8080|8091|vibevoice7b' \
  genki.sh setup.sh || true)

if [[ -n "$retired_matches" ]]; then
  printf 'Retired lifecycle wiring remains:\n%s\n' "$retired_matches" >&2
  exit 1
fi

bash -n genki.sh setup.sh
```

This intentionally checks behaviorally meaningful lifecycle identifiers rather than all provider documentation: `genki.sh` service inventory, startup functions, status/health reporting, and stop-port list; plus `setup.sh` setup and service-report wiring.

- [ ] **Step 2: Run the lifecycle gate to verify RED**

Run:

```bash
bash tests/test_retired_service_lifecycle.sh
```

Expected: FAIL with `Retired lifecycle wiring remains:` and lines from `genki.sh` identifying `PIPER_PORT=8080`, `VIBEVOICE7B_PORT=8091`, `start_piper`, `start_vibevoice7b`, and their lifecycle callers. It may also list the existing Piper/VibeVoice setup references. This failure occurs before deleting a retired server or changing either lifecycle script.

- [ ] **Step 3: Delete the retired tracked implementation and remove lifecycle wiring in the worktree**

Run exactly:

```bash
rm -rf vibevoice7b_server.py tts/server.py scripts/setup-tts.sh mlx-speech docs/INSTALL.legacy.md
```

Expected: the worktree records deletion of the two retired servers, the Piper setup script, the `mlx-speech` mode-`160000` Gitlink, and the entirely Piper-specific legacy document without staging them. Do not use `git submodule deinit`; no `.gitmodules` file exists.

In `genki.sh`, remove `PIPER_PORT`, `VIBEVOICE7B_PORT`, `start_piper`, `start_vibevoice7b`, both status entries, the VibeVoice health URL, both startup calls, and both ports from `cmd_stop`. Change the total service count from 7 to 5. Keep existing retained port values: Kokoro `8880`, F5-TTS `8093`, Maya `8092`, Voice Eval `10301`, and Next.js `9002`.

In `setup.sh`, remove the Piper model directory/download check and the `vibevoice7b` environment block. Update progress counts consistently from six steps to five steps, retain the `genki` and `voice_eval` environment installation, and list only retained services in `verify_setup()`.

In `environment.yml`, delete the complete third `vibevoice7b` environment document. Do not add or remove retained-package versions.

- [ ] **Step 4: Run the lifecycle gate to verify GREEN**

Run:

```bash
bash tests/test_retired_service_lifecycle.sh
```

Expected: PASS with no output. The pass proves the lifecycle scripts no longer name Piper/VibeVoice, define their service ports, start them, include them in status/health output, or stop their ports, and both scripts remain syntactically valid.

- [ ] **Step 5: Rewrite retained documentation rather than leaving stale names**

Apply these exact documentation boundaries:

1. In `README.md`, replace the TTS feature, architecture port list, Conda sections, TTS server sections, endpoint table, supported-provider list, environment example, and tree listing so they name F5-TTS (`8093`) and Kokoro (`8880`) only. Use `TTS_PROVIDER=f5tts`, `TTS_F5TTS_BASE_URL=http://localhost:8093`, `TTS_F5TTS_VOICE=en-Emma_woman`, `TTS_KOKORO_BASE_URL=http://localhost:8880`, and `TTS_KOKORO_VOICE=af_bella` in the environment example. Remove `TTS_ENDPOINT`, `TTS_VOICE`, and all `TTS_VIBEVOICE7B_*` documentation.
2. In `QUICKSTART.md` and `GENKI-SETUP.md`, show retained service lists and ports only: Kokoro, F5-TTS, Maya Live Voice, Voice Eval, and Next.js.
3. In `reference_voices/README.md`, change the heading and sampling-rate explanation to F5-TTS only; remove `vibevoice7b_server.py` and `vibevoice7bVoices` update instructions while keeping the Maya and F5 voice-map update instructions.
4. Do not modify `docs/superpowers/specs/2026-08-31-remove-vibevoice-piper-design.md` or this plan, even though they intentionally contain historical provider names.

- [ ] **Step 6: Run tracked-reference, Gitlink, shell, and test validation**

Run:

```bash
git grep -n -i -E 'vibevoice|piper|mlx-speech' -- ':(top,exclude)docs/superpowers/**'
git ls-files --stage | grep '^160000.*mlx-speech$'
bash -n genki.sh setup.sh
bash tests/test_retired_service_lifecycle.sh
npx vitest run
```

Expected: each of the two `git` searches exits 1 with no output; `bash -n` and the lifecycle gate exit 0; Vitest passes. The first search intentionally excludes `docs/superpowers/**` so the approved design and this execution plan remain available as historical records.

- [ ] **Step 7: Review the uncommitted tracked-cleanup worktree checkpoint**

Run:

```bash
git diff --check -- vibevoice7b_server.py tts/server.py scripts/setup-tts.sh mlx-speech docs/INSTALL.legacy.md genki.sh setup.sh environment.yml README.md QUICKSTART.md GENKI-SETUP.md reference_voices/README.md tests/test_retired_service_lifecycle.sh
git diff --name-only -- vibevoice7b_server.py tts/server.py scripts/setup-tts.sh mlx-speech docs/INSTALL.legacy.md genki.sh setup.sh environment.yml README.md QUICKSTART.md GENKI-SETUP.md reference_voices/README.md tests/test_retired_service_lifecycle.sh
git status --short
```

Expected: no whitespace errors; the relevant diff names only the Task 5 deletion, lifecycle, environment, and documentation paths; `.atl/**`, `tts/models/**`, `models/**`, and Hugging Face cache paths are absent. Leave the checkpoint uncommitted and unstaged for user review; destructive local cache deletion remains outside tracked work.

### Task 6: Validate the Retained Application Before Any Destructive Cleanup

**Files:**
- Verify only: tracked files from Tasks 1-5
- Preserve: `reference_voices/`, `models/`, `tts/models/`, `~/.cache/huggingface/hub/models--appautomaton--vibevoice-mlx/`, and all `.atl/**` paths during this task

**Interfaces:**
- Consumes: the retained service lifecycle from `genki.sh`.
- Produces: operator evidence that app startup, F5-TTS, Kokoro, and at least one retained Maya live-voice path succeed before cache deletion is authorized.

- [ ] **Step 1: Verify static and unit-test gates**

Run:

```bash
npx vitest run
conda run -n genki python -m unittest discover -s tests -p 'test_maya_live_server.py' -v
conda run -n genki python -m py_compile maya_live_server.py
bash tests/test_retired_service_lifecycle.sh
git grep -n -i -E 'vibevoice|piper|mlx-speech' -- ':(top,exclude)docs/superpowers/**'
```

Expected: Vitest, the Python Maya-routing tests, Python compilation, and the shell lifecycle gate exit 0; the Git search exits 1 without results. Do not proceed to cleanup if any command has a different result.

- [ ] **Step 2: Start the retained stack and verify service inventory**

Run:

```bash
./genki.sh start
./genki.sh status
curl -fsS http://localhost:8880/health
curl -fsS http://localhost:8092/health
curl -fsS http://localhost:9002
lsof -i :8080 -i :8091
```

Expected: `status` reports five managed services and names F5-TTS, Kokoro, Maya Live Voice, Voice Eval, and Next.js only; the two health commands return successful JSON; the app request succeeds; `lsof` returns no listeners for the removed Piper and VibeVoice ports. If a retained service does not start, inspect its `/tmp` log, restore the tracked cleanup, and investigate. Do not delete any model or cache in this failure state.

- [ ] **Step 3: Exercise provider selection and live voice in the application**

In Settings, verify the only TTS choices are F5-TTS and Kokoro. Save each provider once and use its Test button; each response must produce playable audio. Generate a deck and confirm new card `voice` values match a Kokoro identifier, not `en_GB-*`, `en_US-*`, or `es_MX-*` Piper identifiers.

In Roleplay, exercise Maya voice with F5-TTS selected in both fast and immersive modes, then with Kokoro selected in fast mode. Expected: each retained-provider flow returns audio; browser/network and Maya logs contain only F5-TTS or Kokoro endpoints; no attempted request goes to `localhost:8080` or `localhost:8091`.

- [ ] **Step 4: Record validation boundary before destructive local cleanup**

Run:

```bash
git status --short
git diff --check
```

Expected: only intended uncommitted tracked cleanup changes and the pre-existing user `.atl/**` modifications are present; no cache/model deletion has happened. If validation failed, stop here and preserve `tts/models/` and `~/.cache/huggingface/hub/models--appautomaton--vibevoice-mlx/` for diagnosis.

### Task 7: Perform Separate, Post-Validation Destructive Cache Cleanup

**Files:**
- Delete locally only after Task 6 succeeds: `tts/models/`
- Delete locally only after Task 6 succeeds: `~/.cache/huggingface/hub/models--appautomaton--vibevoice-mlx/`
- Preserve: `reference_voices/`, repository-root `models/`, F5-TTS and Kokoro Hugging Face cache directories, all `voice-eval/` assets, and `.atl/**`.

**Interfaces:**
- Consumes: explicit successful Task 6 startup and live-voice evidence.
- Produces: no local Piper models and no local VibeVoice repository cache, with no tracked Git change.

- [ ] **Step 1: Reconfirm the exact destructive targets and retained boundaries**

Run:

```bash
test -d tts/models && printf 'Piper models target exists\n'
test -d "$HOME/.cache/huggingface/hub/models--appautomaton--vibevoice-mlx" && printf 'VibeVoice cache target exists\n'
test -d reference_voices && printf 'reference voices preserved\n'
test -d "$HOME/.cache/huggingface/hub/models--hexgrad--Kokoro-82M" && printf 'Kokoro cache preserved\n'
```

Expected: the first two messages identify only the intended cleanup targets when they exist; the final two confirm protected retained assets. Do not replace these paths with a broader `models/`, `hub/`, or home-cache deletion command.

- [ ] **Step 2: Delete only the approved ignored assets**

Run exactly after Step 1 and only after Task 6 success:

```bash
rm -rf tts/models
rm -rf "$HOME/.cache/huggingface/hub/models--appautomaton--vibevoice-mlx"
```

Expected: the commands produce no output and remove only ignored Piper models plus the VibeVoice Hugging Face repository cache. This deletion cannot be restored from Git.

- [ ] **Step 3: Confirm cleanup did not alter tracked work or retained assets**

Run:

```bash
test ! -e tts/models
test ! -e "$HOME/.cache/huggingface/hub/models--appautomaton--vibevoice-mlx"
test -d reference_voices
git status --short
```

Expected: both removed paths are absent, `reference_voices` exists, and Git shows no deletion caused by the ignored cache cleanup. Do not commit this task.

## Final Acceptance Checklist

- [ ] F5-TTS and Kokoro are the only selectable and runnable providers.
- [ ] Missing, Piper, VibeVoice, and unknown persisted provider values normalize and persist as `f5tts` without blocking startup.
- [ ] Generated card voice IDs are retained-provider-compatible Kokoro IDs.
- [ ] The TTS flow and server-action boundary have each demonstrated RED then GREEN for retired Piper/VibeVoice inputs normalizing to F5-TTS, while retained Kokoro remains on its own endpoint.
- [ ] Direct playback, reading, roleplay, voice practice, and Maya live voice use only F5-TTS or Kokoro.
- [ ] Maya immersive mode no longer invokes VibeVoice and honors the retained provider selection.
- [ ] Python unit tests demonstrate immersive F5-TTS and Kokoro routing without starting a service; the shell lifecycle gate demonstrated RED before deletion and GREEN after it.
- [ ] VibeVoice/Piper servers, setup/startup wiring, configuration, UI, documentation, and the `mlx-speech` Gitlink are removed from tracked application paths.
- [ ] `reference_voices/`, F5-TTS assets, and Kokoro assets remain intact.
- [ ] Retained stack startup and live voice succeeded before `tts/models/` and the VibeVoice cache were removed.
- [ ] User-owned `.atl/**` modifications remain untouched and excluded from review checkpoints.
