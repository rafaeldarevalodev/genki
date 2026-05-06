# Genki Sensei - Manual Completo

## Índice

1. [Introducción](#introducción)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Instalaciones Básicas](#instalaciones-básicas)
   - 3.1. Requisitos del Sistema
   - 3.2. Node.js y npm
   - 3.3. Python y Conda
4. [Entornos Conda](#entornos-conda)
   - 4.1. Entorno Base (genki)
   - 4.2. Entorno Voxtral Audio
5. [Servidores TTS (Text-to-Speech)](#servidores-tts)
   - 5.1. Piper TTS (Fallback)
   - 5.2. Voxtral TTS (Principal)
   - 5.3. Iniciarlos Automáticamente
6. [LM Studio - Modelos Locales](#lm-studio---modelos-locales)
   - 6.1. Instalación de LM Studio
   - 6.2. Modelos Recomendados
   - 6.3. Configuración de API Local
7. [Ejecución de la Aplicación](#ejecución-de-la-aplicación)
   - 7.1. Desarrollo (dev)
   - 7.2. Producción (build)
8. [Configuración de Modelos IA](#configuración-de-modelos-ia)
   - 8.1. Voxtral Small (Principal)
   - 8.2. Gemma 4B (Fallback)
   - 8.3. Cambiar entre Modelos
9. [APIs y Endpoints](#apis-y-endpoints)
10. [Tips y Optimizaciones](#tips-y-optimizaciones)
11. [Errores Comunes](#errores-comunes)
12. [Estructura del Proyecto](#estructura-del-proyecto)

---

## 1. Introducción

Genki Sensei es una aplicación web para aprender idiomas mediante flashcards intelligentas, generadas por IA. Utiliza modelos de lenguaje locales a través de LM Studio y servidores TTS locales (Piper y Voxtral) para la pronunciación.

### Características Principales

- **Generación de Cards**: IA crea tarjetas SRS desde cualquier texto en idiomas
- **Quiz Interactivo**: Practice con preguntas generadas por IA
- **Roleplay**: Conversaciónsimulada con la IA
- **TTS**: Pronunciación nativa con Voxtral/Piper
- **100% Local**: Sin dependencias de APIs externas

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
│  ┌──────────────┐    ┌──────────────┐                          │
│  │ Piper TTS    │    │ Voxtral TTS   │                          │
│  │  :8080      │    │   :8000     │                          │
│  │  (Fallback) │    │ (Principal) │                          │
│  └──────────────┘    └──────────────┘                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Puertos Utilizados

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| Next.js Dev | 9002 | Servidor de desarrollo |
| LM Studio | 1234 | API de Chat-compatible |
| Piper TTS | 8080 | TTS fallback |
| Voxtral TTS | 8000 | TTS principal |
| Voice Eval | 10301 | Evaluación de voz |

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
npm --version  # debe ser 10.x.x
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

### 4.1. Entorno Base (genki)

Este entorno se usa para la aplicación Next.js y funciones de IA.

```bash
# Crear entorno
conda create -n genki python=3.11 -y

# Activar
conda activate genki

# Instalar dependencias
cd /Volumes/Rafa\ HD/Freelances/genki
npm install

# Paquetes Python necesarios
pip install genkit dotenv
```

### 4.2. Entorno Voxtral Audio

Este entorno es para el servidor TTS de Voxtral. Requiere `mlx-audio`.

```bash
# Crear entorno con Python 3.12
conda create -n voxtral_audio python=3.12 -y

# Activar
conda activate voxtral_audio

# Instalar mlx-audio (requiere mistral-common)
pip install mlx-audio

# Instalar también mistral-common si hay errores
pip install "mistral-common[audio]"
```

### 4.3. Entorno Voice Evaluation

Este entorno se usa para evaluar pronunciación del usuario.

```bash
# Crear entorno con Python 3.11
conda create -n voice_eval python=3.11 -y

# Activar
conda activate voice_eval

# Instalar dependencias
pip install fastapi uvicorn python-multipart soundfile sounddevice httpx pydantic voxmlx numpy
```

---

## 5. Servidores TTS (Text-to-Speech)

### 5.1. Piper TTS (Fallback)

Piper es un TTS rápido y ligero. Se usa cuando Voxtral no está disponible.

#### Instalación

```bash
# Instalar piper-phonemize
conda activate genki
pip install piper-phonemize numpy

# Descargar modelos (ejemplo)
cd /Volumes/Rafa\ HD/Freelances/genki/tts/models
# Descargar desde https://github.com/rhasspy/piper/tree/master/src/python_run
```

#### Ejecutar Servidor

```bash
cd /Volumes/Rafa\ HD/Freelances/genki/tts
python server.py
# Servidor disponible en http://localhost:8080
```

#### API

```
POST http://localhost:8080/tts
Content-Type: application/json

{"text": "Hola mundo", "voice": "en_US-lessac-medium"}
```

### 5.2. Voxtral TTS (Principal)

Voxtral es un TTS de alta calidad de Mistral, pero requiere parches especiales.

> **Problema Conocido**: El error `There is no Stream(gpu, 0) in current thread` ocurre porque MLX intenta usar la GPU en el hilo incorrecto.

#### Solución: Servidor con Generación por Subproceso

El servidor `audio_server.py` usa un subproceso para generar audio, evitando el error de GPU:

```bash
cd /Volumes/Rafa\ HD/Freelances/genki
conda activate voxtral_audio
python audio_server.py
# Servidor disponible en http://localhost:8000
```

#### API

```
POST http://localhost:8000/v1/audio/speech
Content-Type: application/json

{
  "input": "Hello world",
  "voice": "en_us_aria",
  "emotion": "neutral"
}
```

#### Voces Disponibles

| Voz Internal | Descripción |
|-------------|-------------|
| `casual_female` | Aria - estadounidense, amigable |
| `casual_male` | James - estadounidense, natural |
| `cheerful_female` | Zoe - estadounidense, alegre |
| `neutral_female` | Sophie - británico, elegante |
| `neutral_male` | Oliver - británico, formal |

### 5.3. Iniciarlos Automáticamente

Crear script de inicio:

```bash
# /Volumes/Rafa HD/Freelances/genki/start_servers.sh

#!/bin/bash
cd /Volumes/Rafa\ HD/Freelances/genki

# Iniciar Piper TTS (fondo)
source ~/miniforge3/etc/profile.d/conda.sh
conda activate genki
python tts/server.py > /tmp/piper.log 2>&1 &
echo "Piper TTS iniciado (PID: $!)"

# Iniciar Voxtral TTS (fondo)
conda activate voxtral_audio
python audio_server.py > /tmp/voxtral.log 2>&1 &
echo "Voxtral TTS iniciado (PID: $!)"

# Iniciar Voice Evaluation (fondo)
conda activate voice_eval
python voice_eval/server.py > /tmp/voice_eval.log 2>&1 &
echo "Voice Eval iniciado (PID: $!)"

# Esperar y verificar
sleep 5
curl -s http://localhost:8080/health | jq .status
curl -s http://localhost:8000/health | jq .status
curl -s http://localhost:10301/health | jq .status
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

LM Studio expone una API compatible con OpenAI:

1. Ir a **Settings** > **API**
2. Habilitar **Local Server**
3. Puerto: `1234`
4. Cargar modelo y hacer click en **Start Server**

La API está disponible en:

```
POST http://localhost:1234/v1/chat/completions
Content-Type: application/json

{
  "model": "mistralai_voxtral-small-24b-2507",
  "messages": [{"role": "user", "content": "Hola"}]
}
```

---

## 7. Ejecución de la Aplicación

### 7.1. Desarrollo (dev)

```bash
cd /Volumes/Rafa\ HD/Freelances/genki

# Asegurar que los servidores TTS están corriendo
curl -s http://localhost:8000/health || python audio_server.py &
curl -s http://localhost:8080/health || python tts/server.py &

# Iniciar Next.js
npm run dev
# App disponible en http://localhost:9002
```

### 7.2. Producción (build)

```bash
cd /Volumes/Rafa\ HD/Freelances/genki

# Build de producción
npm run build

# Iniciar servidor
npm start
# App disponible en http://localhost:3000
```

---

## 8. Configuración de Modelos IA

### 8.1. Voxtral Small (Principal)

El modelo Voxtral Small es el principal para chat y generación.

**Prompt para opencode:**

> Configura LM Studio para usar Voxtral Small 24B como modelo principal. Asegúrate de que el servidor local esté corriendo en el puerto 1234 con el modelo `mistralai_voxtral-small-24b-2507` cargado.

### 8.2. Gemma 4B (Fallback)

Gemma 4B es más rápido y se usa cuando Voxtral no está disponible.

**Prompt para opencode:**

> Configura un fallback a Gemma 4B en LM Studio. Cuando Voxtral no esté disponible, usar `google/gemma-4-4b-it` en el puerto 1234.

### 8.3. Cambiar entre Modelos

El cambio de modelo se maneja automáticamente en `src/ai/lib/llm-client.ts`:

```typescript
// prio: Voxtral → Gemma
const response = await fetch(`http://localhost:${PORT}/v1/chat/completions`, ...)
```

Puedes cambiar el modelo desde la configuración en Settings.

---

## 9. APIs y Endpoints

### Genki App (Next.js)

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/` | GET | Página principal |
| `/library` | GET | Biblioteca de decks |
| `/creator` | GET | Creador de contenido |
| `/study/[deckId]` | GET | Estudio de deck |

### API de Acciones (Server Actions)

| Función | Descripción |
|---------|-------------|
| `generateCardsAction` | Generar cards desde texto |
| `generateQuizAction` | Generar preguntas quiz |
| `startRoleplayAction` | Iniciar roleplay |
| `getTTSAudio` | Obtener audio TTS |

### TTS Endpoints

| Servicio | Puerto | Endpoint | Formato |
|----------|--------|----------|---------|
| Piper | 8080 | `/tts` | `{"text": "..."}` |
| Voxtral | 8000 | `/v1/audio/speech` | `{"input": "..."}` |

---

## 10. Tips y Optimizaciones

### Rendimiento

1. **Usar LLMs cuantizados**: Q4_K_M o Q6_K_L consume menos RAM
2. **Cargar modelos solo cuando se usan**: Descargar al terminar sesión
3. **Cache de audio**: Los audios TTS se guardan en localStorage (hasta 4MB)
4. **Usar Voxtral como principal**: Mejor calidad de voz

### Organización

1. **Mantener modelos en SSD rápido**: Los carga más rápido
2. **Limpiar cache de Next.js**: `rm -rf .next`
3. **Monitorear memoria**: `Activity Monitor` o `htop`

### Debugging

1. **Ver logs de TTS**: `/tmp/voxtral.log` y `/tmp/piper.log`
2. **Verificar puertos**: `lsof -i :8000 -i :8080 -i :1234`
3. **Health checks**:
   ```bash
   curl http://localhost:8000/health
   curl http://localhost:8080/health
   curl http://localhost:1234/v1/models
   ```

---

## 11. Errores Comunes

### Error: `EADDRINUSE: address already in use`

**Causa**: Ya hay un proceso usando el puerto.

**Solución**:

```bash
# Encontrar proceso
lsof -i :8000

# Matar proceso
kill -9 <PID>

# O matar todos los procesos de python en ese puerto
lsof -ti :8000 | xargs kill -9
```

### Error: `There is no Stream(gpu, 0) in current thread`

**Causa**: MLX intenta usar GPU en el hilo incorrecto.

**Solución**: Usar el servidor con generación por subproceso (`audio_server.py`) que ya tiene el parche.

### Error: `QuotaExceededError` en localStorage

**Causa**: storage del navegador llena.

**Solución**: La app ahora limpia automáticamente cache antiguo. También puedes:

```javascript
// Limpiar manualmente en consola del navegador
Object.keys(localStorage).forEach(k => localStorage.removeItem(k))
```

### Error: `Cannot read properties of undefined (reading 'query')`

**Causa**: Probably extensión del navegador.

**Solución**: Abrir en incógnito o desactivar extensiones.

### Error: AudioContext no iniciado

**Causa**: Navegador blocks audio antes de interacción.

**Solución**: Click en el botón TTS - se resuelve automáticamente con el gesto del usuario.

### Error: LM Studio no responde

**Causa**: Modelo no cargado o servidor no iniciado.

**Solución**:
1. Cargar modelo en LM Studio
2. Hacer click en "Start Server"
3. Verificar con `curl http://localhost:1234/v1/models`

---

## 12. Estructura del Proyecto

```
genki/
├── .env.local              # Variables de entorno
├── audio_server.py       # Servidor Voxtral TTS
├── README.md           # Este manual
├── package.json         # Dependencias Node
├── next.config.ts     # Config Next.js
│
├── src/
│   ├── ai/
│   │   ├── flows/           # Flows Genkit
│   │   │   ├── text-to-speech.ts
│   │   │   ├── generate-cards-from-text.ts
│   │   │   └── ...
│   │   ├── lib/
│   │   │   └── llm-client.ts  # Cliente LLM con fallback
│   │   └── prompts/         # System prompts
│   │
│   ├── app/
│   │   ├── actions.ts      # Server actions
│   │   ├── layout.tsx     # Layout raíz
│   │   └── (app)/         # Páginas
│   │       ├── library/
│   │       ├── creator/
│   │       └── study/
│   │
│   ├── components/        # Componentes React
│   │   ├── tts-button.tsx
│   │   ├── settings-modal.tsx
│   │   └── ...
│   │
│   ├── contexts/         # React contexts
│   └── hooks/          # Custom hooks
│
├── tts/                  # Servidor Piper
│   ├── server.py
│   └── models/
│
└── models/               # Modelos descargados
    └── Voxtral-4B-TTS/
```

---

## quick reference / Referencia Rápida

```bash
# ===== INICIO RÁPIDO =====

# 1. Activar conda
source ~/miniforge3/etc/profile.d/conda.sh

# 2. Iniciar servidores TTS
conda activate voxtral_audio
python /Volumes/Rafa\ HD/Freelances/genki/audio_server.py &
conda activate genki
python /Volumes/Rafa\ HD/Freelances/genki/tts/server.py &

# 3. Asegurar LM Studio corriendo en :1234

# 4. Iniciar Genki
cd /Volumes/Rafa\ HD/Freelances/genki
npm run dev

# ===== COMANDOS ÚTILES =====

# Ver puertos en uso
lsof -i :8000 -i :8080 -i :1234 -i :9002

# Reiniciar servidor TTS
pkill -f audio_server
conda activate voxtral_audio
python audio_server.py

# Verificar servicios
curl http://localhost:8000/health   # Voxtral
curl http://localhost:8080/health   # Piper
curl http://localhost:1234/v1/models  # LM Studio

# Limpiar cache Next.js
rm -rf /Volumes/Rafa\ HD/Freelances/genki/.next
```

---

**¡Listo!** Ahora tienes un sistema completo de aprendizaje de idiomas con IA local. 🚀

Para dúvidas adicionales, consulta las secciones relevantes de este manual o Abre un issue en el repositorio.