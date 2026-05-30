# Genki 2.0 — Tareas de Implementación

> Plan SRS + Pipeline de Voz. Actualizado: 2026-05-30

---

## Estado del Pipeline de Voz

| Servicio | Implementación | Dependencias Externas |
|---|---|---|
| `genki-voice` FastAPI | ✅ 256 líneas (main.py) | — |
| Kokoro TTS Client | ✅ 165 líneas (`/tts/kokoro.py`) | `KOKORO_URL=http://localhost:5001` |
| Whisper ASR Client | ✅ 321 líneas (`/asr/whisper.py`) | `WHISPER_URL=http://localhost:8001` |
| Silero VAD | ✅ 101 líneas (`/vad/silero.py`) | — |
| Barge-in | ✅ Redis Pub/Sub | `genki-redis:6379` ✅ |

**Faltan**: Servidores Kokoro y Whisper externos no corriendo en Docker.

---

## Phase 8.5: Activación de Pipeline de Voz

**Objetivo**: Integrar Kokoro y Whisper en Docker o como servicios locales, para que el pipeline de voz sea 100% funcional.

- [ ] 8.5.1 Crear `Dockerfile.kokoro` con Kokoro TTS server (o usar imagen oficial)
- [ ] 8.5.2 Crear `Dockerfile.whisper` con mlx-whisper o faster-whisper
- [ ] 8.5.3 Agregar `genki-kokoro` y `genki-whisper` a `docker-compose.genki.yml`
- [ ] 8.5.4 Actualizar variables de entorno en `genki-voice`: `KOKORO_URL`, `WHISPER_URL`
- [ ] 8.5.5 Implementar health checks para ambos servicios
- [ ] 8.5.6 Test de integración: `/v1/voice/conversation` con audio real

---

## Phase 9: Lógica SRS (Spaced Repetition System)

**Objetivo**: Implementar el algoritmo SM-2 en Python, persistido en SQLite, con analytics.

### 9.1 Data Model — Esquema SQL

```sql
-- Tablas para SRS Genki 2.0
-- Archivo: services/genki-db/init-srs.sql

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    created_at REAL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS decks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    source_text TEXT,
    cefr_level TEXT CHECK(cefr_level IN ('A1','A2','B1','B2','C1','C2')),
    created_at REAL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    ipa TEXT,
    spanish_phonetic TEXT,
    explanation TEXT,
    category TEXT CHECK(category IN ('structure','action','concept','modifier','idiom','filler')),
    voice TEXT,
    -- SRS fields
    ef REAL DEFAULT 2.5,
    interval INTEGER DEFAULT 0,
    repetition INTEGER DEFAULT 0,
    next_review REAL DEFAULT (unixepoch()),
    status TEXT DEFAULT 'new' CHECK(status IN ('new','learning','review','mastered')),
    created_at REAL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS card_review_log (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    quality INTEGER NOT NULL CHECK(quality IN (0,3,4,5)),
    response_time_ms INTEGER,
    reviewed_at REAL DEFAULT (unixepoch())
);

CREATE INDEX idx_cards_deck ON cards(deck_id);
CREATE INDEX idx_cards_next_review ON cards(next_review);
CREATE INDEX idx_card_review_log_card ON card_review_log(card_id);
CREATE INDEX idx_cards_status ON cards(status);
CREATE INDEX idx_cards_deck_status ON cards(deck_id, status);
```

### 9.2 Backend SRS Logic — Python

- [ ] 9.2.1 Crear `services/genki-db/app/srs.py` con función `calculate_sm2()`
- [ ] 9.2.2 Mejoras vs V1: Hard(3) → `interval * 0.5` (no reset), Easy(5) → bonus 1.3x, cap `interval` a 365 días
- [ ] 9.2.3 Función `get_due_cards(deck_id, filters)` con filtros por `status`, `category`, `limit`
- [ ] 9.2.4 Métricas: `get_stats(user_id)` → streak, retention_rate_7d, review_heatmap

### 9.3 API Endpoints SRS

- [ ] 9.3.1 `GET /v1/decks` — lista de decks del usuario
- [ ] 9.3.2 `POST /v1/decks` — crear deck
- [ ] 9.3.3 `GET /v1/decks/{deck_id}` — detalle con cards
- [ ] 9.3.4 `DELETE /v1/decks/{deck_id}` — eliminar deck
- [ ] 9.3.5 `GET /v1/decks/{deck_id}/due` — cards due today (`?limit&offset&status&category`)
- [ ] 9.3.6 `POST /v1/decks/{deck_id}/cards` — agregar card
- [ ] 9.3.7 `POST /v1/cards/{card_id}/review` — reportar resultado (quality 0/3/4/5)
- [ ] 9.3.8 `GET /v1/stats` — analytics (streak, retention, heatmap)

### 9.4 Validación y Test

- [ ] 9.4.1 Test del algoritmo SM-2 contra casos known (V1 `calculateSm2`)
- [ ] 9.4.2 Verificar que `get_due_cards` retorna solo cards con `next_review <= now`
- [ ] 9.4.3 Test de concurrencia: múltiples reviews simultáneos

---

## Phase 10: Integración Frontend SRS

**Objetivo**: Conectar `genki-web` con los endpoints SRS del backend.

- [ ] 10.1 Crear `web/src/services/srsApi.ts` — cliente de los endpoints SRS
- [ ] 10.2 Crear `web/src/features/decks/DeckList.tsx` — lista de decks con due count
- [ ] 10.3 Crear `web/src/features/decks/DeckDetail.tsx` — cards del deck, filtro por estado
- [ ] 10.4 Crear `web/src/features/study/StudySession.tsx` — sesión de estudio con grading (0/3/4/5)
- [ ] 10.5 Integrar `updateCardSrs` del hook `useDecks` con `POST /v1/cards/{id}/review`
- [ ] 10.6 Mostrar `next_interval_preview` antes de confirmar respuesta (como V1 `getNextIntervalPreview`)

---

## Phase 11: Integración XP y Gamificación

**Objetivo**: Sistema de puntos y niveles como motivador.

- [ ] 11.1 `POST /v1/cards/{id}/review` retorna `xp_earned`
- [ ] 11.2 Sistema de streak: contar días consecutivos con al menos 1 review
- [ ] 11.3 UI: barra de XP en header, badge de streak
- [ ] 11.4 Badge "Mastered" cuando card pasa a `status='mastered'`

---

## Phase 12: Migración V1 → V2 (Opcional)

**Objetivo**: Permitir exportar desde V1 (localStorage) e importar a V2 (SQLite).

- [ ] 12.1 Endpoint `POST /v1/import` que acepta JSON exportado de V1
- [ ] 12.2 Mapear estructura `Card` de V1 → esquema V2
- [ ] 12.3 UI: pantalla de migración en settings

---

## PR Chain — Plan Actualizado

| PR | Fases | Descripción |
|---|---|---|
| PR#1 | 1-4 | Docker base + DB + Vector + LLM ✅ |
| PR#2 | 5-6 | Voice skeleton + API gateway ✅ |
| PR#3 | 7-8 | Frontend scaffold + Barge-in ✅ |
| PR#4 | 9-10 (GSAP) | GSAP polish ✅ |
| PR#5 | **8.5** | Voice pipeline activation (Kokoro + Whisper en Docker) |
| PR#6 | **9** | SRS Data Model + Backend Logic + API Endpoints |
| PR#7 | **10-11** | Frontend SRS + XP/Gamificación |
| PR#8 | **12** | Migración V1 → V2 (opcional) |

---

## Comparativa V1 vs V2 — SRS

| Aspecto | V1 | V2 |
|---|---|---|
| SRS computation | Client (browser) | Server (Python) |
| Persistencia | localStorage | SQLite |
| Analytics | Ninguna | `card_review_log` completo |
| Multi-device | No | Sí (user_id) |
| Hard handling | Reset a 0 | `interval * 0.5` (no reset) |
| Mastered cap | Sin criterio | `interval > 21 AND ef >= 2.0` |
| Filtros de búsqueda | Solo `getDueCount` | `/due?status=&category=` |
| Response time tracking | No | `response_time_ms` en log |
| Interval cap | Sin límite | Max 365 días |

---

## Criterios de Éxito — Genki 2.0 Completo

| Criterio | Método de verificación |
|---|---|
| Pipeline de voz funcional | `curl -X POST /v1/voice/conversation` retorna audio |
| TTS onset < 1s | Timing desde `maya_response` hasta primer chunk |
| Barge-in < 200ms | Medir tiempo interrupt → audio stop |
| SRS calcula correctamente | Tests contra casos known de V1 |
| Cards due correctas | `SELECT` vs implementación Python |
| API responde < 100ms | Benchmark de endpoints |
