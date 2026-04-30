# Genki Sensei - Manual de Instalación

## Descripción del Proyecto

Genki Sensei es una aplicación de aprendizaje de idiomas con:
- Generación de tarjetas de vocabulario desde texto e imágenes usando IA local (LM Studio)
- Sistema de repetición espaciada (SRS)
- Quiz generados por IA
- Roleplay conversacional
- Text-to-Speech usando Piper TTS local

---

## Requisitos del Sistema

- macOS (Apple Silicon o Intel)
- LM Studio (para modelo de lenguaje local)
- Conda (Miniconda o Anaconda)
- Node.js 18+
- NPM

---

## Parte 1: LM Studio (Modelo de Lenguaje)

### 1.1 Descargar e Instalar LM Studio

1. Ir a https://lmstudio.ai/
2. Descargar la versión para macOS
3. Instalar la aplicación

### 1.2 Configurar LM Studio

1. Abrir LM Studio
2. Ir a la pestaña de modelos
3. Buscar y descargar: `google/gemma-4-26b-a4b`
4. En settings, configurar:
   - API Port: **1234**
   - Enable API: ✅ (activar)
5. Cuando se use el modelo, cargarlo en memoria

---

## Parte 2: Configuración del Proyecto Next.js

### 2.1 Clonar el Proyecto

```bash
cd /Volumes/Rafa\ HD/Freelances/genki
# o donde tengas el proyecto
```

### 2.2 Archivo `.env.local`

Crear archivo `.env.local` en la raíz del proyecto:

```env
OPENAI_API_KEY=no-key-required
OPENAI_BASE_URL=http://127.0.0.1:1234/v1
LOCAL_MODEL=google/gemma-4-26b-a4b

# TTS Configuration (Piper)
TTS_ENDPOINT=http://localhost:8080
TTS_VOICE=en_GB-alan-medium
```

### 2.3 Instalar Dependencias

```bash
npm install
```

**Corrección de versiones** (si hay conflictos):
```bash
# En package.json, cambiar:
"genkitx-openai": "0.30.0"
"@genkit-ai/next": "1.33.0"
"genkit": "1.33.0"
"genkit-cli": "1.33.0"

npm install
```

### 2.4 Iniciar la App

```bash
npm run dev
# La app corre en http://localhost:9002
```

---

## Parte 3: Piper TTS (Text-to-Speech)

### 3.1 Estructura de Directorios

```
genki/
├── tts/
│   ├── models/
│   │   ├── en_US-lessac-medium.onnx
│   │   ├── en_US-lessac-medium.onnx.json
│   │   ├── es_MX-claude-high.onnx
│   │   ├── es_MX-claude-high.onnx.json
│   │   └── en_GB-alan-medium.onnx
│   │   └── en_GB-alan-medium.onnx.json
│   └── server.py
└── scripts/
    ├── setup-tts.sh
    └── start-tts.sh
```

### 3.2 Instalar Piper TTS

#### Paso 1: Instalar Conda (si no lo tienes)

```bash
# Descargar Miniconda
curl -L -o ~/miniconda.sh https://repo.anaconda.com/miniconda/Miniconda3-latest-MacOSX-arm64.sh
sh ~/miniconda.sh

# Agregar al PATH
echo 'export PATH="$HOME/miniforge3/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

#### Paso 2: Crear Entorno Conda

```bash
conda create -n genki python=3.11 -y
conda activate genki
pip install piper-tts numpy
```

#### Paso 3: Descargar Modelos de Voz

Los modelos se descargan automáticamente con el script o manual:

```bash
cd tts/models

# Modelo Inglés Americano ( Lessac )
curl -L -o en_US-lessac-medium.onnx "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx"
curl -L -o en_US-lessac-medium.onnx.json "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json"

# Modelo Español Mexicano
curl -L -o es_MX-claude-high.onnx "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_MX/claude/high/es_MX-claude-high.onnx"
curl -L -o es_MX-claude-high.onnx.json "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_MX/claude/high/es_MX-claude-high.onnx.json"

# Modelo Inglés Británico ( Alba )
curl -L -o en_GB-alan-medium.onnx "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx"
curl -L -o en_GB-alan-medium.onnx.json "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alba-medium.onnx.json"
```

### 3.3 Servidor TTS - `tts/server.py`

Este es el código del servidor TTS:

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genki Sensei - Piper TTS Server
Puerto: 8080
"""

import argparse
import json
import os
import sys
import socket
import wave
import io
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

DEFAULT_PORT = 8080
DEFAULT_MODEL = "en_US-lessac-medium"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(SCRIPT_DIR, "models")

AVAILABLE_MODELS = {
    "en_US-lessac-medium": os.path.join(MODELS_DIR, "en_US-lessac-medium.onnx"),
    "es_MX-claude-high": os.path.join(MODELS_DIR, "es_MX-claude-high.onnx"),
    "en_GB-alan-medium": os.path.join(MODELS_DIR, "en_GB-alan-medium.onnx"),
}

# Cache de voces cargadas
voice_cache = {}

def load_voice(model_path):
    """Cargar una voz (con cache)"""
    if model_path not in voice_cache:
        from piper.voice import PiperVoice
        voice_cache[model_path] = PiperVoice.load(model_path)
    return voice_cache[model_path]

def synthesize_wav(text, model_path):
    """Sintetizar texto a audio WAV"""
    voice = load_voice(model_path)
    config = voice.config
    
    audio_chunks = list(voice.synthesize(text))
    
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(config.sample_rate)
        
        for chunk in audio_chunks:
            if chunk._audio_int16_bytes:
                wav_file.writeframes(chunk._audio_int16_bytes)
            else:
                import numpy as np
                audio_int16 = (chunk.audio_float_array * 32767).astype(np.int16)
                wav_file.writeframes(audio_int16.tobytes())
    
    return buffer.getvalue()

class PiperTTSHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"[TTS] {self.address_string()} - {format % args}")

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            response = {
                "status": "ok",
                "models": {name: os.path.exists(path) for name, path in AVAILABLE_MODELS.items()},
                "default": DEFAULT_MODEL
            }
            self.wfile.write(json.dumps(response).encode())
            return
        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/tts":
            self.send_response(404)
            self.end_headers()
            return

        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        
        try:
            data = json.loads(body.decode("utf-8"))
        except:
            self.send_error(400, "Invalid JSON")
            return

        text = data.get("text", "").strip()
        model = data.get("voice", DEFAULT_MODEL)

        if not text:
            self.send_error(400, "Text is required")
            return

        model_path = AVAILABLE_MODELS.get(model)
        if not model_path or not os.path.exists(model_path):
            self.send_error(400, f"Model '{model}' not found")
            return

        try:
            print(f"[TTS] Synthesizing: '{text[:50]}...' with {model}", flush=True)
            audio_data = synthesize_wav(text, model_path)
            print(f"[TTS] Generated {len(audio_data)} bytes", flush=True)
            
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Transfer-Encoding", "binary")
            self.end_headers()
            self.wfile.write(audio_data)
        except Exception as e:
            print(f"[TTS Error] {e}")
            self.send_error(500, str(e))

def find_free_port(start_port=DEFAULT_PORT):
    for port in range(start_port, start_port + 100):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(("localhost", port))
                return port
        except OSError:
            continue
    raise RuntimeError("No se encontró puerto libre")

def run_server(port=DEFAULT_PORT):
    if not os.path.exists(MODELS_DIR):
        os.makedirs(MODELS_DIR, exist_ok=True)

    try:
        from piper.voice import PiperVoice
    except ImportError:
        print("❌ Error: piper no está instalado")
        print("   Ejecuta: pip install piper-tts")
        sys.exit(1)

    models_installed = [m for m, p in AVAILABLE_MODELS.items() if os.path.exists(p)]
    actual_port = find_free_port(port)

    print(f"========================================")
    print(f"Genki Sensei - TTS Server")
    print(f"========================================")
    print(f"  Puerto: http://localhost:{actual_port}")
    print(f"  Modelos: {', '.join(models_installed) if models_installed else 'ninguno'}")
    print(f"  Por defecto: {DEFAULT_MODEL}")
    print(f"")
    print(f"Endpoints:")
    print(f"  GET  /health   - Health check")
    print(f"  POST /tts     - Generar audio")
    print(f"")
    print(f"Presiona Ctrl+C para detener")
    print(f"========================================")

    server = HTTPServer(("localhost", actual_port), PiperTTSHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Deteniendo servidor...")
        server.shutdown()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("-p", "--port", type=int, default=DEFAULT_PORT)
    args = parser.parse_args()
    run_server(args.port)
```

### 3.4 Iniciar el Servidor TTS

```bash
# Activar entorno conda
source ~/miniforge3/etc/profile.d/conda.sh
conda activate genki

# Ir al directorio tts
cd tts

# Iniciar servidor
python server.py -p 8080
```

O usar el script:

```bash
cd /Volumes/Rafa\ HD/Freelances/genki
bash scripts/start-tts.sh
```

### 3.5 Verificar que TTS Funciona

```bash
# Health check
curl http://localhost:8080/health

# Test síntesis
curl -X POST http://localhost:8080/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world", "voice": "en_GB-alan-medium"}' \
  -o test.wav
file test.wav
# Debe mostrar: RIFF WAVE audio
```

---

## Parte 4: Uso de la Aplicación

### 4.1 Iniciar Todo

**Terminal 1 - Servidor TTS:**
```bash
cd tts
python server.py -p 8080
```

**Terminal 2 - App Next.js:**
```bash
cd genki
npm run dev
```

### 4.2 Flujo de Uso

1. Abrir http://localhost:9002/library
2. Ir a "Create" para crear un nuevo deck
3. Ingresar texto y generar tarjetas
4. Ir a Study para estudiar
5. Usar el botón de audio para escuchar pronunciación
6. Marcar las tarjetas según dificultad (SRS)

---

## Parte 5: Solución de Problemas

### TTS no funciona
```bash
# Verificar que el servidor esté corriendo
lsof -i :8080

# Si no está, iniciarlo
cd tts && python server.py -p 8080
```

### LM Studio no responde
```bash
# Verificar LM Studio esté corriendo
# Puerto 1234 debe estar en uso
lsof -i :1234
```

### Error de modelo no encontrado
- Verificar que el modelo esté descargado en LM Studio
- Verificar que LM Studio tenga la API habilitada

### Error en generation de tarjetas
- Revisar logs del servidor: `tail -30 /tmp/next-dev.log`
- Verificar LM Studio esté corriendo y el modelo cargado

---

## Comandos Rápidos de Referencia

```bash
# Iniciar app Next.js
npm run dev

# Iniciar TTS servidor
cd tts && python server.py -p 8080

# Ver servicios corriendo
lsof -i :9002  # Next.js
lsof -i :8080  # TTS
lsof -i :1234  # LM Studio

# Test TTS directo
curl -X POST http://localhost:8080/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello"}'

# Test LM Studio directo
curl http://localhost:1234/v1/models
```

---

## Notas Adicionales

- El modelo por defecto de TTS se configura en `.env.local` con `TTS_VOICE`
- Para usar otra voz, debe estar descargada en `tts/models/`
- Los scripts de inicio están en `scripts/start-tts.sh`
- El proyecto Originally fue creado con Firebase App Hosting

---

**Autor:** Genki Sensei  
**Fecha:** Abril 2026