# Genki Sensei - Manual Completo

## Índice

1. [Introducción](#introducción)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Instalaciones Básicas](#instalaciones-básicas)
4. [Entornos Conda](#entornos-conda)
5. [Servidores TTS](#servidores-tts)
6. [LM Studio - Modelos Locales](#lm-studio---modelos-locales)
7. [Ejecución de la Aplicación](#ejecución-de-la-aplicación)
8. [APIs y Endpoints](#apis-y-endpoints)
9. [Features IA](#features-ia)
10. [Configuración de Entorno](#configuración-de-entorno)
11. [Errores Comunes](#errores-comunes)
12. [Estructura del Proyecto](#estructura-del-proyecto)

---

## 1. Introducción

Genki Sensei es una aplicación web para aprender idiomas mediante flashcards inteligentes generadas por IA. Utiliza modelos de lenguaje locales a través de LM Studio y servidores TTS locales para pronunciación nativa.

### Características Principales

- **Generación de Cards**: IA crea tarjetas SRS desde cualquier texto
- **Word Mode / Chunks Mode**: Extrae vocabulario individual o frases completas
- **Categorización Automática**: Cards organizadas por categoría (action, structure, concept, modifier, idiom, filler)
- **Quiz Interactivo**: Práctica con preguntas generadas por IA
- **Roleplay**: Conversación simulada con Maya (tutor de inglés)
- **Live Voice Mode**: Conversación inmersiva con voz real tiempo real
- **Voice Practice**: Evaluación de pronunciación fonema por fonema
- **TTS**: Pronunciación nativa con Piper/Kokoro/VibeVoice 7B
- **CEFR Classification**: Clasificación automática de nivel (A1-C2)
- **Phrase Explorer**: Feedback educativo sobre uso de vocabulario
- **Cloud LLM**: NVIDIA API para respuestas de IA (configurable a local)

---

## 2. Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        Genki Sensei                              │
│                    (Next.js :9002)                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Frontend   │───▶│  Cloud API   │───▶│  Codestral   │      │
│  │   Next.js    │    │  (Groq/Mistral)│  │  LLM        │      │
│  │  :9002      │    │  :443         │    │              │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                     │                                   │
│         ▼                    ▼                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │sessionStorage│    │   TTS        │    │ Voice Eval   │      │
│  │ (Audio Cache)│    │  Servers     │    │  :10301     │      │
│  └──────────────┘    │ 8080/8880/   │    └──────────────┘      │
│                      │ 8091/8092    │                          │
│                      │              │                          │
│                      │ 8092: Maya    │                          │
│                      │ Live Voice   │                          │
│                      └──────────────┘                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Puertos Utilizados

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| Next.js | 9002 | Aplicación web |
| Cloud LLM API | 443 | NVIDIA API (moonshotai/kimi-k2.6) |
| Piper TTS | 8080 | TTS rápido |
| Kokoro TTS | 8880 | TTS alternativo |
| VibeVoice 7B TTS | 8091 | TTS alta calidad con voice cloning |
| Maya Live Voice | 8092 | Live Voice Mode con streaming |
| Voice Eval | 10301 | Evaluación de pronunciación |

---

## 3. Instalaciones Básicas

### 3.1. Requisitos del Sistema

- **macOS** con chip Apple Silicon (M1/M2/M3/M4) - Recomendado
- **RAM**: Mínimo 16GB, recomendado 32GB+
- **Almacenamiento**: 20GB+ libres para modelos

### 3.2. Node.js y npm

```bash
# Instalar Node.js (usando nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.zshrc
nvm install 20
nvm use 20

# Verificar instalación
node --version  # debe ser v20.x.x
npm --version   # debe ser 10.x.x
```

### 3.3. Python y Conda

```bash
# Instalar Miniforge (más rápido que Anaconda)
cd ~/Downloads
curl -L -O https://github.com/conda/conda/releases/latest/download/Miniforge3-MacOSX-arm64.sh
bash Miniforge3-MacOSX-arm64.sh

# Activar conda
source ~/miniforge3/etc/profile.d/conda.sh
conda init zsh

# Reiniciar terminal o ejecutar
source ~/.zshrc
```

---

## 4. Entornos Conda

### Crear todos los entornos automáticamente

```bash
conda env create -f environment.yml
```

### Entornos individuales

#### genki (Base)
Para Piper TTS, Kokoro TTS y funciones básicas de IA.

```bash
conda create -n genki python=3.11 -y
conda activate genki
pip install genkit dotenv
```

#### voice_eval
Para evaluación de pronunciación (difflib-based, sin dependencias externas de ASR).

```bash
conda create -n voice_eval python=3.11 -y
conda activate voice_eval
pip install fastapi uvicorn python-multipart soundfile sounddevice httpx pydantic numpy
```

#### vibevoice7b
Para VibeVoice 7B TTS con voice cloning (requiere ~22GB RAM).

```bash
conda create -n vibevoice7b python=3.11 -y
conda activate vibevoice7b
pip install mlx huggingface_hub[hf_xet] soundfile numpy
```

---

## 5. Servidores TTS

### 5.1. Piper TTS

Piper es un TTS rápido y ligero.

```bash
conda activate genki
cd tts
python server.py
# Servidor disponible en http://localhost:8080
```

**API:**
```
POST http://localhost:8080/tts
{"text": "Hello world", "voice": "en_GB-alan-medium"}
```

**Voces Disponibles:**

| Voz | Descripción |
|-----|-------------|
| `en_GB-alan-medium` | Británico, varón |
| `en_US-lessac-medium` | Estadounidense, varón |
| `en_US-ryan-high` | Estadounidense, varón (agudo) |

### 5.2. Kokoro TTS

TTS basado en Kokoro con múltiples voces.

```bash
conda activate genki
python kokoro_server.py
# Servidor disponible en http://localhost:8880
```

**Voces Disponibles:**
- `af_bella`, `af_nicole`, `af_sarah`, `af_sky`
- `am_adam`, `am_eric`, `am_fen`, `am_michael`
- Y muchas más...

### 5.3. VibeVoice 7B TTS

VibeVoice Large es un modelo de 7B parámetros con voice cloning y mejor calidad de audio.

**Modelo:** `appautomaton/vibevoice-mlx` (7B, int8 quantized, ~10 GB)

```bash
conda activate vibevoice7b
python vibevoice7b_server.py
# Servidor disponible en http://localhost:8091
```

**API:**
```
POST http://localhost:8091/v1/audio/speech
{
  "input": "Hello world",
  "voice": "en-Emma_woman"
}
```

**Voces Disponibles:**

| Voz | Descripción | Tipo |
|-----|-------------|------|
| `en-Emma_woman` | Mujer americana | preset |
| `en-Davis_man` | Hombre americano | preset |
| `en-Carter_man` | Hombre americano formal | preset |
| `en-Grace_woman` | Mujer americana joven | preset |
| `en-Mike_man` | Hombre americano casual | preset |

**Voces personalizadas:**
- Subir audio de referencia desde Settings (max 5MB)
- Se almacenan en localStorage (temporal)

**Multi-speaker:**
```
POST http://localhost:8091/v1/audio/speech
{
  "input": "Speaker 0: Hello!\nSpeaker 1: Hi there!",
  "voice": "en-Emma_woman"
}
```

**Archivos de referencia:**
Los clips de referencia están en `/reference_voices/`:
- `en_Emma_woman.wav`, `en_Davis_man.wav`, etc.

### 5.4. Iniciar Todos los Servidores

```
./genki.sh start
```

Verificar estado:
```
./genki.sh status
```

---

## 6. LLM - Modelos de Lenguaje

Genki usa **LLM en la nube** (Groq/Mistral) por defecto para mejor rendimiento.

### Configuración en `.env.local`

```env
LLM_PROVIDER=cloud
CLOUD_MODEL=moonshotai/kimi-k2.6
CLOUD_API_KEY=tu-api-key
CLOUD_BASE_URL=https://api.nvidia.com/v1/experimental/mistral-ai/codestral-latest
```

### LM Studio (Opcional - Local)

Si prefieres usar modelos locales:

1. Descargar desde: https://lmstudio.ai/
2. Cargar un modelo (ej: `mistralai/voxtral-small-24b-2507`)
3. Click en **Start Server** (puerto 1234)
4. Configurar `.env.local`:
```env
LLM_PROVIDER=local
LOCAL_MODEL_NAME=gemma
```

---

## 7. Ejecución de la Aplicación

### 7.1. Desarrollo (dev)

```bash
# Asegurar que los servidores TTS están corriendo
./genki.sh start --dev

# Iniciar Next.js
npm run dev
# App disponible en http://localhost:9002
```

### 7.2. Producción (build)

```bash
npm run build
npm start
# App disponible en http://localhost:3000
```

---

## 8. APIs y Endpoints

### Genki App (Next.js)

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/` | GET | Redirect a /library |
| `/library` | GET | Biblioteca de decks |
| `/creator` | GET | Creador de contenido con IA |
| `/study/[deckId]` | GET | Sesión de estudio |

### TTS Endpoints

| Servicio | Puerto | Endpoint | Formato |
|----------|--------|----------|---------|
| Piper | 8080 | `/tts` | `{"text": "...", "voice": "..."}` |
| Kokoro | 8880 | `/v1/audio/speech` | `{"input": "...", "voice": "..."}` |
| VibeVoice 7B | 8091 | `/v1/audio/speech` | `{"input": "...", "voice": "...", "reference_audio_data": "..."}` |

### Maya Live Voice API

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/health` | GET | Estado del servicio |
| `/v1/voice/conversation` | POST | Pipeline completo: VAD → ASR → LLM → TTS streaming |
| `/v1/voice/session/reset` | POST | Reset historial de sesión |
| `/v1/voice/abort` | POST | Abortar sesión actual |

**Pipeline de Live Voice:**
```
1. POST /v1/voice/conversation con { user_audio: base64 }
2. VAD detecta si hay habla
3. ASR transcribe audio (mlx-whisper)
4. LLM genera respuesta de Maya (2-3 frases)
5. TTS streaming audio chunks
6. Cliente puede abortar en cualquier momento (AbortController)
```

### Voice Evaluation API

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/health` | GET | Estado del servicio |
| `/evaluators` | GET | Listar evaluadores disponibles |
| `/evaluate` | POST | Evaluar pronunciación |

**Evaluadores disponibles:**

| Evaluador | Descripción |
|-----------|-------------|
| `whisper` | mlx-whisper ASR (Apple Silicon, default) |
| `difflib` | Difflib-based (fallback, sin ASR externo) |

---

## 9. Features IA

### 9.1. Generación de Flashcards

**Flow:** `src/ai/flows/generate-cards-from-text.ts`

Extrae vocabulario de cualquier texto en inglés y genera flashcards con:
- `front`: Chunk en inglés
- `back`: Traducción español / original
- `ipa`: Pronunciación IPA estándar
- `spanish_ipa`: Fonética amigable para hispanohablantes
- `explanation`: Explicación gramatical en español
- `voice`: Voz TTS asignada aleatoriamente

### 9.2. Quiz Interactivo

**Flow:** `src/ai/flows/generate-quiz-questions.ts`

Genera preguntas de opción múltiple con:
- 1 respuesta correcta
- 3 distractores plausibles
- Orden aleatorio

### 9.3. Roleplay Conversacional

**Flow:** `src/ai/flows/simulate-language-roleplay.ts`

- **Tutor:** Maya (tutor conversacional de inglés)
- Respuestas cortas (2-3 frases) para mantener ritmo de conversación
- Correcciones indirectas con `[note]`
- Mantiene historial de conversación
- Toggle entre modo Chat y modo Voice en la UI

### 9.4. Live Voice Mode (Inmersivo)

**Componentes:**
- `src/hooks/useLiveVoice.ts` - Hook principal con abort + barge-in
- `src/workers/audio-stream.worker.ts` - WebWorker para playback
- `src/components/roleplay/live-voice-ui.tsx` - UI simplificada con avatar

**Pipeline completo (Estrategia B):**
```
User habla → VAD → ASR (mlx-whisper) → LLM (Maya) → TTS Streaming
                ↑                                              |
                └──────── Barge-in (AbortController) ────────┘
```

**Features:**
- Abort completo: AbortController cancela fetch + LLM
- Session reset: Maya olvida lo que iba a decir en interrupción
- Push-to-talk: Mantén para hablar, suelta para enviar
- Transcripción visible: Usuario ve qué entendió Maya

### 9.5. Evaluación de Roleplay

**Flow:** `src/ai/flows/evaluate-roleplay-performance.ts`

Después de una sesión de roleplay:
- Calificación 0-100
- Feedback detallado
- 3 tips de mejora

### 9.5. Voice Practice (Pronunciación)

**Flow:** `src/ai/flows/voice-practice.ts`

Sistema completo de práctica de pronunciación:
1. Genera audio de referencia (Kokoro TTS)
2. Graba pronunciación del usuario
3. Evalúa fonema por fonema
4. Devuelve:
   - `score`: Puntuación global
   - `transcription`: Lo que el usuario dijo
   - `phoneme_details`: Estado por fonema (correct/warning/error)
   - `feedback_text`: Feedback detallado

**Mapeo de emociones:**
| Emoción | Voz TTS |
|---------|---------|
| neutral | neutral_male |
| cheerful | cheerful_female |
| excited | casual_male |
| empathetic | casual_female |

### 9.6. Clasificación CEFR

**Flow:** `src/ai/flows/classify-text-cefr.ts`

Clasifica textos automáticamente en niveles CEFR:
- **A1**: Principiante básico
- **A2**: Principiante elementary
- **B1**: Intermediate
- **B2**: Upper intermediate
- **C1**: Advanced
- **C2**: Proficiency

Incluye justificación de la clasificación.

### 9.7. Phrase Explorer (Feedback de Frases)

**Flow:** `src/ai/flows/explore-phrase.ts`

Evalúa uso de vocabulario en frases del usuario:
- **Tutor:** Dr. James Morrison (tutor de inglés senior)
- Verifica uso correcto del chunk
- Proporciona feedback educativo
- Corrige y annotationa la frase

### 9.8. Text-to-Speech

**Flow:** `src/ai/flows/text-to-speech.ts`

Soporta múltiples proveedores TTS:
- **Piper** (rápido, ligero)
- **Kokoro** (buena calidad, múltiples voces)
- **VibeVoice 7B** (la mejor calidad, voice cloning)

**Cacheo de audio (temporal):**
- Usa `sessionStorage` para cachear audios generados
- Límite: 30 entradas máximo
- Solo textos < 200 caracteres se cachean
- Se limpia automáticamente al cerrar el tab
- Migración futura a backend con base de datos

Devuelve audio en formato base64 (data URL).

---

## 10. Configuración de Entorno

### Variables de entorno (`.env.local`)

```bash
# LLM Configuration
LLM_PROVIDER=cloud          # 'local' o 'cloud'
CLOUD_MODEL=moonshotai/kimi-k2.6
CLOUD_API_KEY=your-key
CLOUD_BASE_URL=https://api.nvidia.com/v1/experimental/mistral-ai/codestral-latest

# TTS Configuration
TTS_PROVIDER=vibevoice7b    # 'piper', 'kokoro', 'vibevoice7b'
TTS_ENDPOINT=http://localhost:8080
TTS_VOICE=en_GB-alan-medium
TTS_KOKORO_VOICE=af_bella
TTS_VIBEVOICE7B_BASE_URL=http://localhost:8091
TTS_VIBEVOICE7B_VOICE=en-Sara_woman
TTS_PLAYBACK_SPEED=1
```

### Proveedores LLM

#### Local (LM Studio)

```bash
# Configurar en .env.local
LLM_PROVIDER=local
LOCAL_MODEL_NAME=gemma
```

#### Cloud (Groq - Recomendado para desarrollo)

```bash
LLM_PROVIDER=cloud
CLOUD_MODEL=llama-3.3-70b-versatile
CLOUD_BASE_URL=https://api.groq.com/openai/v1
CLOUD_API_KEY=tu-api-key
```

---

## 11. Errores Comunes

### Error: `EADDRINUSE: address already in use`

**Causa**: Ya hay un proceso usando el puerto.

**Solución:**
```bash
# Encontrar proceso
lsof -i :9002

# Matar proceso
kill -9 <PID>
```

### Error: `QuotaExceededError` en localStorage

**Causa**: storage del navegador llena.

**Solución**: La app limpia automáticamente cache antiguo. También:
```javascript
Object.keys(localStorage).forEach(k => localStorage.removeItem(k))
```

### Error: AudioContext no iniciado

**Causa**: Navegador bloquea audio antes de interacción.

**Solución**: Click en botón TTS - se resuelve automáticamente.

### Error: LM Studio no responde

**Solución:**
1. Cargar modelo en LM Studio
2. Hacer click en "Start Server"
3. Verificar con `curl http://localhost:1234/v1/models`

---

## 12. Estructura del Proyecto

```
genki/
├── .env.local              # Variables de entorno
├── genki.sh              # Manager unificado (start/stop/status)
├── setup.sh              # Instalación completa
├── environment.yml       # Entornos Conda
├── kokoro_server.py       # Servidor Kokoro TTS
├── vibevoice7b_server.py  # Servidor VibeVoice 7B TTS
├── README.md              # Este manual
├── QUICKSTART.md          # Guía rápida
├── │
├── src/
│   ├── ai/
│   │   ├── flows/              # Genkit AI flows
│   │   │   ├── generate-cards-from-text.ts      # Flashcard generation
│   │   │   ├── generate-quiz-questions.ts      # Quiz generation
│   │   │   ├── text-to-speech.ts              # TTS (multi-provider)
│   │   │   ├── voice-practice.ts             # Pronunciation eval
│   │   │   ├── simulate-language-roleplay.ts # Conversation roleplay
│   │   │   ├── evaluate-roleplay-performance.ts # Roleplay feedback
│   │   │   ├── explore-phrase.ts             # Phrase feedback
│   │   │   └── classify-text-cefr.ts         # CEFR classification
│   │   │
│   │   └── llm.ts          # LLM client con fallback
│   │
│   ├── app/
│   │   ├── actions.ts      # Server Actions
│   │   ├── layout.tsx     # Root layout
│   │   └── (app)/         # Páginas
│   │       ├── library/
│   │       ├── creator/
│   │       └── study/
│   │
│   ├── components/        # Componentes React
│   │   ├── flashcard-view.tsx
│   │   ├── quiz-view.tsx
│   │   ├── roleplay-view.tsx
│   │   │   ├── roleplay/
│   │   │   │   └── live-voice-ui.tsx   # Live Voice Mode UI
│   │   ├── voice-practice-view.tsx
│   │   ├── tts-button.tsx
│   │   └── ui/            # shadcn/ui components
│   │
│   ├── hooks/             # Custom hooks
│   │   └── useLiveVoice.ts   # Live Voice hook con abort/barge-in
│   │
│   ├── workers/           # WebWorkers
│   │   └── audio-stream.worker.ts  # Audio playback sin bloquear UI
│   │
│   ├── contexts/          # React contexts
│   ├── lib/
│   │   ├── types.ts       # TypeScript interfaces
│   │   ├── srs.ts        # SM-2 algorithm
│   │   └── utils.ts
│
├── tts/                   # Servidor Piper
│   └── server.py
│
├── kokoro_server.py       # Servidor Kokoro TTS (8880)
├── vibevoice7b_server.py   # Servidor VibeVoice 7B TTS (8091)
├── maya_live_server.py     # Servidor Maya Live Voice (8092) - FastAPI
│
├── reference_voices/      # Voice cloning reference audio files
│   ├── en_Emma_woman.wav
│   ├── en_Sara_woman.mp3
│   ├── maya_ref.wav      # (opcional) Voice reference para Maya
│   └── ...
│
├── mlx-speech/            # appautomaton/mlx-speech (VibeVoice 7B runtime)
│
├── voice-eval/            # Voice Evaluation API
│   ├── main_api.py        # FastAPI server
│   └── src/
│       └── ai/
│           ├── types.py
│           └── evaluators/
│               ├── base.py
│               ├── factory.py
│               ├── difflib_eval.py
│               └── whisper_eval.py
│
└── models/                # Modelos descargados
    └── kokoro/           # Kokoro TTS models
```

---

## Referencia Rápida

### Inicio rápido

Copia y pega en tu terminal:

```
./genki.sh start
```

Luego abre tu navegador y escribe:

```
http://localhost:9002
```

---

### Comandos

| Qué quieres hacer | Copia y pega |
|-------------------|--------------|
| Iniciar todo | `./genki.sh start` |
| Iniciar sin app web | `./genki.sh start --dev` |
| Ver qué está corriendo | `./genki.sh status` |
| Detener todo | `./genki.sh stop` |
| Reiniciar | `./genki.sh restart` |

### Para desarrollo

1. Copia y pega: `./genki.sh start --dev`
2. En otra terminal: `npm run dev`

---

## Data Models

### Card
```typescript
interface Card {
  front: string;        // English chunk
  back: string;         // Spanish translation / original
  ipa: string;          // IPA pronunciation
  spanish_phonetic: string; // Spanish-friendly phonetic
  explanation: string;  // Grammar explanation (Spanish)
  category: 'structure' | 'action' | 'concept' | 'modifier' | 'idiom' | 'filler';
  srs: SrsData;         // Spaced repetition data
  voice?: string;       // TTS voice assignment
}
```

### Deck
```typescript
interface Deck {
  id: string;
  name: string;
  cards: Card[];
  createdAt: string;
  sourceText: string;
  sourceImages?: string[];
  cefrLevel?: string;   // A1-C2 classification
}
```

### UserProfile
```typescript
interface UserProfile {
  level: number;
  xp: number;
}
```

---

**¡Listo!** Ahora tienes un sistema completo de aprendizaje de idiomas con IA local. 🚀
