# Retain F5-TTS and Kokoro Only

Remove the VibeVoice and Piper voice paths so Genki has two supported providers: F5-TTS and Kokoro. The cleanup must keep live voice working, including Maya immersive mode, and defer destructive cache deletion until startup has been validated.

## Scope

| Area | Decision |
|---|---|
| Supported providers | Retain F5-TTS and Kokoro only. |
| Provider state | Change defaults to a supported provider and migrate persisted VibeVoice/Piper selections to a supported value. |
| Live voice | Route every live-voice path, including Maya immersive mode, through F5-TTS or Kokoro. |
| Removal | Delete VibeVoice/Piper application code, servers, setup/startup wiring, configuration, UI, and documentation. |
| Dependency | Remove the `mlx-speech` Gitlink, which is VibeVoice-only. |
| Assets | Preserve `reference_voices/` plus F5-TTS and Kokoro assets. |

## Non-Goals

- Do not alter F5-TTS or Kokoro behavior beyond provider selection and routing.
- Do not add a replacement voice provider or change voice quality settings.
- Do not remove tracked model weights: none are present in this repository.
- Do not delete ignored runtime models or external caches before validation.

## Implementation Sequence

1. Inventory provider references and define one supported fallback for invalid persisted values.
2. Update defaults, validation, and persisted-state migration so VibeVoice/Piper values resolve to that fallback.
3. Reroute live voice and Maya immersive mode to the retained providers; verify provider selection remains coherent across UI and runtime.
4. Remove VibeVoice/Piper code, setup/startup scripts, configuration, UI controls, documentation, and the `mlx-speech` Gitlink.
5. Start the application and exercise retained-provider startup plus live voice before any asset cleanup.
6. After successful validation, delete ignored local Piper models and the external VibeVoice Hugging Face cache. This is a destructive, post-validation operational step.

## Failure and Rollback

- A stale persisted provider must not prevent startup; it must be migrated to the supported fallback.
- If startup or live voice fails, restore the removed tracked changes and investigate before deleting any ignored models or external cache.
- Cache deletion is not recoverable from Git. Keep it separate from the tracked cleanup and perform it only after validation succeeds.
- Preserve `reference_voices/` and F5/Kokoro assets throughout; they are not cleanup targets.

## Acceptance Criteria

- [ ] F5-TTS and Kokoro are the only selectable and runnable providers.
- [ ] Defaults and persisted VibeVoice/Piper values resolve to a supported provider without blocking startup.
- [ ] Live voice and Maya immersive mode use only retained-provider paths.
- [ ] No tracked VibeVoice/Piper code, setup/startup/configuration/UI/documentation references remain.
- [ ] The `mlx-speech` Gitlink is removed.
- [ ] `reference_voices/` and F5/Kokoro assets remain intact.
- [ ] Application startup and a retained live-voice path are validated before Piper-model and VibeVoice-cache deletion.
- [ ] Ignored Piper models and the external VibeVoice Hugging Face cache are removed only as a separate, post-validation destructive step.
