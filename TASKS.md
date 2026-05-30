# Genki 2.0 — Tareas de Implementación

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~3000-4000 (greenfield rebuild) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: Base infrastructure + DB + Vector + LLM / PR 2: Voice service + API gateway / PR 3: Frontend scaffold + Barge-in + ASR/TTS pipeline / PR 4: GSAP polish |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending (user choice required) |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

---

## Phase 1: Docker Base Infrastructure

**Objetivo**: Crear la topologia de servicios, redes, y volúmenes compartidos.

- [x] 1.1 Crear `docker-compose.genki.yml` con servicios: genki-db, genki-vector, genki-llm, genki-voice, genki-api, genki-frontend
- [x] 1.2 Configurar red `genki-net` (bridge) con driver bridge
- [x] 1.3 Crear volumenes nombrados: `genki-db-data` (/var/lib/genki), `genki-qdrant` (/qdrant/storage), `genki-model-cache` (/model_cache)
- [x] 1.4 Crear volumen compartido `/tmp/genki/ipc` para chunks de audio entre voice y api
- [x] 1.5 Configurar health checks para cada servicio (`/health` endpoint)
- [x] 1.6 Configurar `depends_on` con `condition: service_healthy` para encadenamiento de inicio

---

## Phase 2: genki-db (SQLite)

**Objetivo**: Persistencia de perfiles de usuario y progreso de aprendizaje.

- [x] 2.1 Crear `Dockerfile.db` con SQLite + directorio de datos volume-mounted
- [x] 2.2 Definir schema inicial: users, session_history, learning_progress, deck_progress
- [x] 2.3 Crear script de inicialización `init-db.sql` que corre en startup
- [x] 2.4 Exponer puerto 5432 (o usar socket Unix via volume)
- [x] 2.5 Configurar health check: `sqlite3 /var/lib/genki/genki.db "SELECT 1"`

---

## Phase 3: genki-vector (Qdrant Embedded)

**Objetivo**: Memoria semántica persistente para contexto de sesión.

- [x] 3.1 Crear `Dockerfile.vector` con Qdrant embedded mode
- [x] 3.2 Configurar collection `sessions` con esquema: session_id, user_id, timestamp, vector, text_chunk
- [x] 3.3 Crear script de migration `migrate-collections.sh` para schema versioning
- [x] 3.4 Exponer puerto 6333 (REST) y 6334 (gRPC)
- [x] 3.5 Montar volumen `genki-qdrant` para persistencia
- [x] 3.6 Health check: `curl localhost:6333/readyz`

---

## Phase 4: genki-llm (Ollama + Minimax 2.7)

**Objetivo**: Backend de LLM local con inferencia en Apple Silicon.

- [x] 4.1 Crear `Dockerfile.llm` con Ollama server
- [x] 4.2 Pre-configurar `ollama serve` con modelo Minimax 2.7 Q4_K_M
- [x] 4.3 Crear `modelfile` para Minimax 2.7 con optimizaciones M3 Max (Flash Attention, thread count)
- [x] 4.4 Exponer puerto 11434 (API REST)
- [x] 4.5 Health check: `curl localhost:11434/api/tags` (verifica modelos cargados)
- [x] 4.6 Configurar `OLLAMA_HOST=0.0.0.0` para aceptación de conexiones externas

---

## Phase 5: genki-voice Base (FastAPI + Kokoro + mlx-whisper Skeleton)

**Objetivo**: Servicio de voz con ASR y TTS skeleton, listo para integración concurrente.

- [ ] 5.1 Crear `Dockerfile.voice` con Python 3.11 + FastAPI
- [ ] 5.2 Crear estructura `packages/genki-voice/`: app/, asr/, tts/, vad/, proto/
- [ ] 5.3 Definir `proto/voice.proto` con servicio VoiceService, mensajes AudioChunk, VoiceEvent, Transcription, TTSChunk
- [ ] 5.4 Crear servidor gRPC básico con stubs generados (solo signature, sin implementación)
- [ ] 5.5 Crear endpoints HTTP de health: `GET /health` (modelos cargados), `GET /health/ready`
- [ ] 5.6 Crear Dockerfile que instala mlx-whisper, Kokoro, y genera stubs protobuf
- [ ] 5.7 Exponer puertos: 8092 (gRPC), 8091 (HTTP fallback)

---

## Phase 6: genki-api Gateway (FastAPI Orchestration)

**Objetivo**: Orquestación de servicios, event bus, y gestión de sesiones.

- [ ] 6.1 Crear `Dockerfile.api` con FastAPI + Redis client
- [ ] 6.2 Crear `packages/genki-api/`: app/, routes/, services/, middleware/
- [ ] 6.3 Implementar cliente Redis Pub/Sub (`src/lib/event-bus.ts` o `event_bus.py`)
- [ ] 6.4 Crear endpoint `POST /interrupt` que PUBLISH a canal `barge_in:{session_id}`
- [ ] 6.5 Crear endpoint `POST /session/start` que inicializa estado en Redis
- [ ] 6.6 Crear endpoint `GET /session/{id}/status` para polling de estado
- [ ] 6.7 Implementar middleware de logging y tracing (request_id propagate)
- [ ] 6.8 Exponer puerto 8090

---

## Phase 7: Frontend Monorepo Scaffold

**Objetivo**: Estructura de paquetes compartida y configuración base.

- [ ] 7.1 Crear `packages/` en raíz del repo con workspaces npm/yarn/pnpm
- [ ] 7.2 Crear `packages/shared/` con tipos TypeScript: `VoiceEvent`, `GenkiEvent`, `AudioChunk`, `Session`
- [ ] 7.3 Crear `packages/shared/tsconfig.json` exports
- [ ] 7.4 Crear `packages/genki-voice-client/` (cliente gRPC para frontend)
- [ ] 7.5 Configurar root `tsconfig.json` con paths alias `@genki/shared` -> `packages/shared/src`
- [ ] 7.6 Agregar grpc-web y protobufjs a `packages/genki-voice-client/`

---

## Phase 8: Barge-in System (Event Bus + Interrupt Propagation)

**Objetivo**: Señal de interrupción que para ASR, TTS, y LLM concurrentemente.

- [ ] 8.1 Implementar `AbortController` propagation en genki-voice:接收 barge_in event → llama ` cancel()` en ASR y TTS
- [ ] 8.2 Implementar `cancel()` propagation en genki-llm: recibe barge_in → aborta generacion de tokens
- [ ] 8.3 Implementar `barge_in` handler en genki-api: Redis SUBSCRIBE canal `barge_in:{session_id}` → forward a servicios
- [ ] 8.4 Crear idempotency en barge_in: múltiples interrupts = single cleanup
- [ ] 8.5 Agregar botón de interrupt en UI frontend (`src/components/InterruptButton.tsx`)
- [ ] 8.6 Verificar: inject interrupt event via Redis → todos los servicios paran dentro de <200ms

---

## Phase 9: Concurrent ASR+TTS Pipeline (Core Latency Fix)

**Objetivo**: Pipeline donde ASR y TTS corren en paralelo, no secuencial.

- [ ] 9.1 Implementar streaming partial transcription en mlx-whisper (chunked results)
- [ ] 9.2 Implementar Kokoro streaming: chunks de audio de 500ms onset, no esperar finalizacion
- [ ] 9.3 Modificar state machine: `idle → listening → processing → speaking → idle`
- [ ] 9.4 Implementar concurrent execution: LLM tokens start arriving → Kokoro empieza a sintetizar
- [ ] 9.5 Implementar audio chunk sequencing: timestamps + chunk_index para ordenar reproduccion
- [ ] 9.6 Crear buffer de reproduccion en frontend: recibe chunks, ordena por index, play con WebAudio API
- [ ] 9.7 Target: audio onset < 1s desde que LLM empieza a responder

---

## Phase 10: GSAP Micro-interactions + UX Polish

**Objetivo**: Enmascarar latencia percibida con animaciones fluidas.

- [ ] 10.1 Integrar GSAP en frontend (`npm install gsap`)
- [ ] 10.2 Animar waveform visualizer durante `listening` (scale + opacity)
- [ ] 10.3 Animar transcription text: fade-in con stagger por palabra
- [ ] 10.4 Animar TTS playback: waveform circular con progress ring
- [ ] 10.5 Animar barge-in: quick fade-out + snap to idle state
- [ ] 10.6 Crear `LoadingStates` component con skeleton animations para cada estado
- [ ] 10.7 Implementar `useLiveVoice.ts` refactor: timer-based → Silero VAD
- [ ] 10.8 Crear `vad.worker.ts`: Web Worker que corre Silero VAD model inference

---

## Verification Criteria

| Phase | Criterio |
|-------|----------|
| 1 | `docker compose -f docker-compose.genki.yml config` pasa sin errores |
| 2 | `docker compose up genki-db` → SQLite inicializado con schema |
| 3 | `curl localhost:6333/readyz` → 200 |
| 4 | `curl localhost:11434/api/tags` → Minimax 2.7 listada |
| 5 | `docker compose up genki-voice` → health check pasa con modelos cargados |
| 6 | `POST /session/start` → crea session en Redis |
| 7 | `ls packages/shared/` → tipos exportados |
| 8 | Interrupt button → todos los servicios paran |
| 9 | Audio onset < 1s (medir con timestamp LLM response start vs primer chunk TTS) |
| 10 | Animaciones corren a 60fps sin jank |

---

## Suggested Work Units (PRs)

| PR | Contenido | Base branch |
|----|-----------|-------------|
| PR 1 | Phase 1-4: Docker base + DB + Vector + LLM | main |
| PR 2 | Phase 5-6: Voice skeleton + API gateway | main (after PR1) |
| PR 3 | Phase 7-8: Frontend scaffold + Barge-in | main (after PR2) |
| PR 4 | Phase 9-10: Concurrent pipeline + GSAP | main (after PR3) |

**Chain strategy options** (elegir uno):
- **stacked-to-main**: cada PR mergea a main en orden. Rápido, fix on the go.
- **feature-branch-chain**: PR1 → tracker branch, PR2 → PR1 branch, etc. Solo tracker mergea a main. Mejor control de rollback.