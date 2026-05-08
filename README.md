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
- **Quiz Interactivo**: Práctica con preguntas generadas por IA
- **Roleplay**: Conversación simulada con la IA (tutor Dr. Sarah Chen)
- **Voice Practice**: Evaluación de pronunciación fonema por fonema
- **TTS**: Pronunciación nativa con Voxtral/Piper/Kokoro
- **CEFR Classification**: Clasificación automática de nivel (A1-C2)
- **Phrase Explorer**: Feedback educativo sobre uso de vocabulario
- **100% Local**: Sin dependencias de APIs externas (opcional cloud)

---

## 2. Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        Genki Sensei                              │
│                    (Next.js :9002)                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Frontend   │───▶│  LM Studio   │───▶│  Voxtral    │      │
│  │   Next.js    │    │   :1234      │    │ Small 24B   │      │
│  │  :9002      │    │  (Chat API)  │    │  (LoRA)     │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                     │                                   │
│         ▼                    ▼                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ localStorage │    │   TTS        │    │ Voice Eval   │      │
│  │ (Decks,     │    │  Servers     │    │  :10301     │      │
│  │  Profile)   │    │  8000/8080/  │    │ (VoxMLX/MFA)│      │
│  └──────────────┘    │   8880      │    └──────────────┘      │
│                      └──────────────┘                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Puertos Utilizados

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| Next.js Dev | 9002 | Servidor de desarrollo |
| LM Studio | 1234 | API de Chat-compatible |
| Voxtral TTS | 8000 | TTS principal (Apple Silicon) |
| Piper TTS | 8080 | TTS fallback |
| Kokoro TTS | 8880 | TTS alternativo |
| VibeVoice TTS | 8090 | TTS realtime (Microsoft) |
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
Para Piper TTS y funciones básicas de IA.

```bash
conda create -n genki python=3.11 -y
conda activate genki
pip install genkit dotenv
```

#### voxtral_audio
Para Voxtral TTS (requiere Apple Silicon con mlx-audio).

```bash
conda create -n voxtral_audio python=3.12 -y
conda activate voxtral_audio
pip install mlx-audio "mistral-common[audio]" numpy
```

#### voice_eval
Para evaluación de pronunciación (VoxMLX o Montreal Forced Aligner).

```bash
conda create -n voice_eval python=3.11 -y
conda activate voice_eval
pip install fastapi uvicorn python-multipart soundfile sounddevice httpx pydantic voxmlx numpy
```

---

## 5. Servidores TTS

### 5.1. Voxtral TTS (Principal - Apple Silicon)

Voxtral es un TTS de alta calidad de Mistral, optimizado para Apple Silicon.

```bash
conda activate voxtral_audio
python audio_server.py
# Servidor disponible en http://localhost:8000
```

**API:**
```
POST http://localhost:8000/v1/audio/speech
{
  "input": "Hello world",
  "voice": "en_us_aria",
  "response_format": "wav"
}
```

**Voces Disponibles:**

| Voz Internal | Embedding | Descripción |
|-------------|-----------|-------------|
| `en_us_aria` | `casual_female` | Estadounidense, amigable |
| `en_us_zoe` | `cheerful_female` | Estadounidense, alegre |
| `en_us_james` | `casual_male` | Estadounidense, natural |
| `en_gb_sophie` | `neutral_female` | Británico, elegante |
| `en_gb_oliver` | `neutral_male` | Británico, formal |

### 5.2. Piper TTS (Fallback)

Piper es un TTS rápido y ligero. Se usa cuando Voxtral no está disponible.

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

### 5.3. Kokoro TTS (Alternativo)

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

### 5.4. VibeVoice TTS (Realtime)

VibeVoice-Realtime es un modelo de síntesis de voz de Microsoft, optimizado para latencia ultra-baja (~300ms).

**Modelo:** `mlx-community/VibeVoice-Realtime-0.5B-4bit` (1.2 GB, MLX)

```bash
conda activate voxtral_audio
python vibevoice_server.py
# Servidor disponible en http://localhost:8090
```

**API:**
```
POST http://localhost:8090/v1/audio/speech
{
  "input": "Hello world",
  "voice": "en-Emma_woman"
}
```

**Voces Disponibles:**

| Voz | Descripción |
|-----|-------------|
| `en-Emma_woman` | Estadounidense, mujer |
| `en-Davis_man` | Estadounidense, varón |
| `en-Carter_man` | Estadounidense, varón formal |
| `en-Grace_woman` | Estadounidense, mujer joven |
| `en-Mike_man` | Estadounidense, varón casual |
| `en-Samuel_man` | Estadounidense, varón |
| `en-Ashley_woman` | Estadounidense, mujer |
| `en-Floyd_man` | Estadounidense, varón |
| `en-Roger_man` | Estadounidense, varón |
| `en-Sara_woman` | Estadounidense, mujer |

**Características:**
- Latencia ~300ms (first audio chunk)
- Single-speaker
- Max ~10 minutos de audio
- Soporte MLX (Apple Silicon)
- English only

### 5.5. Iniciar Todos los Servidores

```bash
./start-servers.sh start
```

Verificar estado:
```bash
./start-servers.sh status
```

---

## 6. LM Studio - Modelos Locales

### 6.1. Instalación de LM Studio

1. Descargar desde: https://lmstudio.ai/
2. Instalar la aplicación
3. Abrir LM Studio

### 6.2. Modelos Recomendados

| Modelo | Tamaño | Uso | Descarga |
|--------|-------|-----|---------|
| Voxtral Small 24B | ~24GB | Chat principal | `mistralai/voxtral-small-24b-2507` |
| Gemma 4B | ~4GB | Fallback rápido | `google/gemma-4-4b-it` |
| Gemma 27B | ~27GB | Mejor calidad | `google/gemma-4-27b-it` |

#### Descargar en LM Studio

1. Ir a la pestaña **Models**
2. Buscar `mistralai/voxtral-small-24b-2507`
3. Seleccionar versión **Q6_K_L** (recomendado) o Q4_K_M
4. Click **Download**

### 6.3. Configuración de API Local

1. Ir a **Settings** > **API**
2. Habilitar **Local Server**
3. Puerto: `1234`
4. Cargar modelo y hacer click en **Start Server**

---

## 7. Ejecución de la Aplicación

### 7.1. Desarrollo (dev)

```bash
# Asegurar que los servidores TTS están corriendo
./start-servers.sh start

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
| Voxtral | 8000 | `/v1/audio/speech` | `{"input": "..."}` |
| Piper | 8080 | `/tts` | `{"text": "...", "voice": "..."}` |
| Kokoro | 8880 | `/v1/audio/speech` | `{"input": "...", "voice": "..."}` |
| VibeVoice | 8090 | `/v1/audio/speech` | `{"input": "...", "voice": "..."}` |

### Voice Evaluation API

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/health` | GET | Estado del servicio |
| `/evaluators` | GET | Listar evaluadores disponibles |
| `/evaluate` | POST | Evaluar pronunciación |

**Evaluadores disponibles:**

| Evaluador | Descripción |
|-----------|-------------|
| `voxmlx` | VoxMLX - Alineador fonético |
| `mfa` | Montreal Forced Aligner |

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

- **Tutor:** Dr. Sarah Chen (tutor conversacional senior)
- Usa vocabulario objetivo naturalmente
- Correcciones indirectas con `[tutor note]`
- Mantiene historial de conversación

### 9.4. Evaluación de Roleplay

**Flow:** `src/ai/flows/evaluate-roleplay-performance.ts`

Después de una sesión de roleplay:
- Calificación 0-100
- Feedback detallado
- 3 tips de mejora

### 9.5. Voice Practice (Pronunciación)

**Flow:** `src/ai/flows/voice-practice.ts`

Sistema completo de práctica de pronunciación:
1. Genera audio de referencia (Voxtral TTS)
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
- **Voxtral** (principal, Apple Silicon, mlx-audio)
- **Piper** (fallback, ligero)
- **Kokoro** (alternativo, múltiples voces)
- **VibeVoice** (realtime, Microsoft, ~300ms latency)

Devuelve audio en formato base64 (data URL).

---

## 10. Configuración de Entorno

### Variables de entorno (`.env.local`)

```bash
# LLM Configuration
LLM_PROVIDER=local          # 'local' o 'cloud'
LOCAL_MODEL_NAME=voxtral    # 'gemma' o 'voxtral'
CLOUD_MODEL=llama-3.3-70b-versatile
CLOUD_API_KEY=your-key
CLOUD_BASE_URL=https://api.groq.com/openai/v1

# TTS Configuration
TTS_PROVIDER=voxtral        # 'piper', 'voxtral', 'kokoro', o 'vibevoice'
TTS_ENDPOINT=http://localhost:8080
TTS_VOICE=en_GB-alan-medium
TTS_VOXTRAL_VOICE=en_us_aria
TTS_KOKORO_VOICE=af_bella
TTS_VIBEVOICE_BASE_URL=http://localhost:8090
TTS_VIBEVOICE_VOICE=en-Emma_woman
TTS_PLAYBACK_SPEED=1
```

### Proveedores LLM

#### Local (LM Studio)

```bash
# Configurar en .env.local
LLM_PROVIDER=local
LOCAL_MODEL_NAME=voxtral    # o 'gemma'
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
lsof -i :8000

# Matar proceso
kill -9 <PID>
```

### Error: `There is no Stream(gpu, 0) in current thread`

**Causa**: MLX intenta usar GPU en el hilo incorrecto.

**Solución**: Usar `audio_server.py` con generación por subproceso.

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
├── audio_server.py        # Servidor Voxtral TTS
├── kokoro_server.py       # Servidor Kokoro TTS
├── vibevoice_server.py    # Servidor VibeVoice TTS
├── README.md              # Este manual
├── QUICKSTART.md          # Guía rápida
├── environment.yml        # Entornos Conda
├── start-servers.sh       # Script de inicio
├── setup.sh               # Setup completo
│
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
│   │   ├── voice-practice-view.tsx
│   │   ├── tts-button.tsx
│   │   └── ui/            # shadcn/ui components
│   │
│   ├── contexts/          # React contexts
│   ├── hooks/             # Custom hooks
│   └── lib/
│       ├── types.ts       # TypeScript interfaces
│       ├── srs.ts        # SM-2 algorithm
│       └── utils.ts
│
├── tts/                   # Servidor Piper
│   └── server.py
│
├── voice-eval/            # Voice Evaluation API
│   ├── main_api.py        # FastAPI server
│   ├── voxmlx_server.py
│   └── src/
│       └── ai/
│           ├── types.py
│           └── evaluators/
│               ├── base.py
│               ├── factory.py
│               ├── mfa_eval.py
│               └── voxmlx_eval.py
│
└── models/                # Modelos descargados
    └── Voxtral-4B-TTS/
```

---

## quick reference / Referencia Rápida

```bash
# ===== INICIO RÁPIDO =====

# 1. Activar conda
source ~/miniforge3/etc/profile.d/conda.sh

# 2. Crear entornos
conda env create -f environment.yml

# 3. Iniciar servidores TTS
./start-servers.sh start

# 4. Asegurar LM Studio corriendo en :1234
#    (o usar LLM_PROVIDER=cloud en .env.local)

# 5. Iniciar Genki
npm run dev
# App: http://localhost:9002

# ===== COMANDOS ÚTILES =====

# Ver puertos en uso
lsof -i :8000 -i :8080 -i :8880 -i :10301 -i :1234 -i :9002

# Estado de servidores
./start-servers.sh status

# Reiniciar servidores
./start-servers.sh restart

# Ver logs
tail -f /tmp/voxtral.log
tail -f /tmp/piper.log
tail -f /tmp/vibevoice.log
tail -f /tmp/voice-eval.log

# Health checks
curl http://localhost:8000/health   # Voxtral
curl http://localhost:8080/health   # Piper
curl http://localhost:8090/health   # VibeVoice
curl http://localhost:8880/health   # Kokoro
curl http://localhost:10301/health  # Voice Eval
curl http://localhost:1234/v1/models # LM Studio
```

---

## Data Models

### Card
```typescript
interface Card {
  front: string;        // English chunk
  back: string;         // Spanish translation / original
  ipa: string;          // IPA pronunciation
  spanish_ipa: string; // Spanish-friendly phonetic
  explanation: string;  // Grammar explanation (Spanish)
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
