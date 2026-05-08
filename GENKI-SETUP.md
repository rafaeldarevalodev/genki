# Genki Sensei - Manual de Instalación 🚀

> **Para:** Perfil Junior  
> **Nivel de dificultad:** Principiante a Intermedio  
> **Tiempo estimado:** 30-60 minutos

---

## 📖 Tabla de Contenidos

1. [¿Qué es Genki Sensei?](#1-qué-es-genki-sensei)
2. [🧰 Requisitos del Sistema](#2🧰-requisitos-del-sistema)
3. [📦 Instalación Paso a Paso](#3📦-instalación-paso-a-paso)
4. [🏗️ Arquitectura del Sistema](#4🏗️-arquitectura-del-sistema)
5. [🚀 Cómo Iniciar los Servicios](#5🚀-cómo-iniciar-los-servicios)
6. [💻 Uso de la Aplicación](#6💻-uso-de-la-aplicación)
7. [❓ Problemas Comunes](#7❓-problemas-comunes)
8. [📚 Vocabulario](#8📚-vocabulario)

---

## 1. ¿Qué es Genki Sensei?

🎯 **Objetivo:** Entender qué vamos a construir.

Genki Sensei es una **aplicación web para aprender idiomas** que usa Inteligencia Artificial funcionando 100% en tu computadora (sin internet para la IA).

### ✨ Características Principales

| Característica | Descripción |
|---------------|-------------|
| 🃏 **Flashcards Inteligentes** | Crea tarjetas de vocabulario desde cualquier texto |
| 🎯 **Repetición Espaciada (SRS)** | El sistema te muestra las palabras justo cuando las vas a olvidar |
| 🗣️ **Práctica de Voz** | Graba tu pronunciación y la IA te dice qué tan bien lo hiciste |
| 💬 **Roleplay** | Practica conversaciones con un tutor de IA |
| 🔊 **Text-to-Speech (TTS)** | Escucha la pronunciación correcta |

### 💡 ¿Por qué es especial?

- **100% Local** - No necesitas internet para estudiar
- **Gratis** - Sin suscripciones
- **Privado** - Tus datos nunca salen de tu computadora
- **IA Avanzada** - Usa modelos de lenguaje como Voxtral y Gemma

---

## 2. 🧰 Requisitos del Sistema

🎯 **Objetivo:** Verificar que tu computadora pueda correr la aplicación.

### Hardware Mínimo

| Componente | Mínimo | Recomendado |
|------------|--------|-------------|
| 💾 **Almacenamiento** | 20 GB libres | 50 GB libres |
| 🧠 **RAM** | 16 GB | 32 GB |
| 🍎 **Sistema** | macOS (cualquier versión) | macOS con chip M1/M2/M3/M4 |

### ⚠️ Nota Importante sobre RAM

> Si tienes 16GB de RAM, algunos modelos de IA pueden hacer que tu computadora se puesta lenta. Considera cerrar otras aplicaciones mientras usas Genki.

### Software Necesario

| Software | Para qué sirve | ¿Cómo obtenerlo? |
|----------|----------------|------------------|
| **macOS** | Sistema operativo | Ya lo tienes si usas Mac |
| **Node.js** | Ejecutar la aplicación web | Se instala más adelante |
| **Conda (Miniforge)** | Gestionar entornos de Python | Se instala más adelante |
| **LM Studio** | Ejecutar modelos de IA | Descargar de [lmstudio.ai](https://lmstudio.ai) |

### 💡 Tip: ¿Por qué necesitamos tantas cosas?

Imagina que Genki Sensei es como una cocina:
- **macOS** = La cocina física
- **Node.js** = Los utensilios básicos
- **Conda** = Diferentes áreas de preparación (una para Pasteles, otra para Carnes)
- **LM Studio** = El chef experto que prepara la comida (IA)

Cada uno tiene su función específica y trabaja junto.

---

## 3. 📦 Instalación Paso a Paso

🎯 **Objetivo:** Instalar todo lo necesario para que funcione la aplicación.

### 3.1 Instalar Node.js

📋 **Pasos:**

```bash
# 1. Instalar nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# 2. Cerrar y abrir la terminal, o ejecutar:
source ~/.zshrc

# 3. Instalar Node.js versión 20
nvm install 20
nvm use 20

# 4. Verificar instalación
node --version
```

🔍 **Verificación:** El comando debe mostrar `v20.x.x` (donde x es un número)

💡 **Tip:** Cada vez que abras una terminal nueva, ejecuta `nvm use 20` para activar Node.js.

---

### 3.2 Instalar Conda (Miniforge)

📋 **Pasos:**

```bash
# 1. Descargar Miniforge para Mac con chip Apple
cd ~/Downloads
curl -L -O https://github.com/conda-conda/conda/releases/latest/download/Miniforge3-MacOSX-arm64.sh

# 2. Instalar
bash Miniforge3-MacOSX-arm64.sh

# 3. Aceptar todas las preguntas (presiona Enter varias veces)
# Cuando pregunte "¿Do you wish the installer to initialize Miniforge3?", escribe "yes"

# 4. Cerrar y abrir terminal, o ejecutar:
source ~/miniforge3/etc/profile.d/conda.sh

# 5. Verificar
conda --version
```

🔍 **Verificación:** Debe mostrar una versión como `24.x.x`

💡 **Tip:** El instalador agrega conda a tu `.zshrc` automáticamente. Si no quieres esperar, ejecuta `source ~/miniforge3/etc/profile.d/conda.sh` cada vez.

⚠️ **Nota:** Si tienes problemas con Miniforge, también puedes usar [Miniconda](https://docs.conda.io/en/latest/miniconda.html) que es más ligero.

---

### 3.3 Descargar e Instalar LM Studio

📋 **Pasos:**

```bash
# 1. Ir a https://lmstudio.ai/
# 2. Descargar la versión para Mac
# 3. Arrastrar a Aplicaciones
# 4. Abrir LM Studio
```

🔍 **Verificación:** Cuando abras LM Studio, verás una ventana como esta:

```
┌─────────────────────────────────┐
│  LM Studio                      │
│  ┌─────────────────────────┐    │
│  │ 🔍 Buscar modelos...  │    │
│  └─────────────────────────┘    │
│                                  │
│  Modelos Populares             │
│  ┌─────┐ ┌─────┐ ┌─────┐       │
│  │ Q8  │ │ Q6  │ │ Q4  │       │
│  └─────┘ └─────┘ └─────┘       │
└─────────────────────────────────┘
```

⚠️ **Nota:** LM Studio se usará después. Por ahora, solo ténlo instalado.

---

### 3.4 Descargar Modelos de IA

📋 **Pasos:**

1. **Abre LM Studio**
2. **Busca este modelo:** `mistralai/voxtral-small-24b-2507`
3. **Selecciona la versión Q6_K_L** (recomendado) o Q4_K_M
4. **Click en "Download"**

💡 **Tip:** El modelo ocupa aproximadamente 15-20GB. Asegúrate de tener espacio.

🔍 **Verificación:** En la pestaña "Models", verás el modelo descargado.

---

### 3.5 Clonar e Instalar el Proyecto

📋 **Pasos:**

```bash
# 1. Ir al directorio donde quieres el proyecto
cd ~/Proyectos

# 2. Clonar el repositorio (o copia manual los archivos)
git clone https://github.com/tu-usuario/genki.git
cd genki

# 3. Instalar dependencias de Node.js
npm install
```

🔍 **Verificación:** No debe haber errores rojos al final.

---

### 3.6 Crear Entornos de Python

📋 **Pasos:**

```bash
# 1. Activar conda
source ~/miniforge3/etc/profile.d/conda.sh
conda activate base

# 2. Crear el entorno principal (genki)
conda create -n genki python=3.11 -y

# 3. Activar el entorno
conda activate genki

# 4. Instalar dependencias
pip install genkit dotenv numpy

# 5. Crear entorno para Voxtral (TTS avanzado)
conda create -n voxtral_audio python=3.12 -y
conda activate voxtral_audio
pip install mlx-audio "mistral-common[audio]"

# 6. Crear entorno para Voice Evaluation
conda create -n voice_eval python=3.11 -y
conda activate voice_eval
pip install fastapi uvicorn python-multipart soundfile sounddevice httpx pydantic voxmlx numpy

# 7. Crear entorno para VibeVoice 7B (voice cloning, ~22GB RAM)
conda create -n vibevoice7b python=3.13 -y
conda activate vibevoice7b
pip install mlx huggingface_hub[hf_xet] soundfile numpy
```

🔍 **Verificación:** Ejecuta `conda env list` y debes ver:
```
genki
voxtral_audio
voice_eval
vibevoice7b
base
```

💡 **Tip:** ¿Qué es un entorno? Es como una "burbuja" separada de Python. Cada proyecto puede tener sus propias versiones de paquetes sin冲突.

⚠️ **Nota:** La primera vez que actives `voxtral_audio` y ejecutes algo con `mlx-audio`, el modelo se cargará y puede tomar varios minutos.

---

### 3.7 Descargar Modelos de TTS (Voces)

📋 **Pasos:**

```bash
# Volver al entorno genki
conda activate genki

# Ir al directorio de modelos TTS
cd tts/models

# Descargar modelo de voz en_US-lessac-medium
curl -L -o en_US-lessac-medium.onnx "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx"
curl -L -o en_US-lessac-medium.onnx.json "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json"

# Descargar modelo de voz en_GB-alan-medium
curl -L -o en_GB-alan-medium.onnx "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx"
curl -L -o en_GB-alan-medium.onnx.json "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx.json"
```

🔍 **Verificación:** Ejecuta `ls -la` y debes ver los archivos `.onnx` y `.onnx.json`.

💡 **Tip:** Estos son los archivos que Piper usa para generar voz.

---

## 4. 🏗️ Arquitectura del Sistema

🎯 **Objetivo:** Entender cómo se conectan todas las partes.

### 🗺️ Diagrama de Comunicación

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TU COMPUTADORA                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────┐         ┌────────────────┐                    │
│  │   NAVEGADOR    │         │  CLOUD API    │                    │
│  │   (Chrome)    │◄───────►│ (Groq/Mistral)│                    │
│  │  :9002         │         │   :443         │                    │
│  └───────┬────────┘         └────────┬───────┘                    │
│          │                            │                              │
│          │ HTTP                      │ HTTP                         │
│          ▼                            ▼                              │
│  ┌─────────────────────────────────────────────────────────┐      │
│  │                    NEXT.JS (Aplicación Web)               │      │
│  │                         :9002                            │      │
│  └─────────────────────────┬───────────────────────────────┘      │
│                            │                                      │
│          ┌─────────────────┼─────────────────┐                  │
│          │                 │                 │                  │
│          ▼                 ▼                 ▼                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   VOXTRAL  │  │  VIBEVOICE  │  │   KOKORO   │          │
│  │   TTS      │  │   7B        │  │   TTS      │          │
│  │   :8000    │  │   :8091     │  │   :8880    │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 🔌 ¿Qué significa cada puerto?

| Puerto | Servicio | ¿Para qué sirve? |
|--------|----------|-------------------|
| **9002** | Next.js | La aplicación web que ves en el navegador |
| **443** | Cloud LLM API | Modelos de IA en la nube (Groq/Mistral) |
| **8000** | Voxtral TTS | Generación de voz (Apple Silicon) |
| **8080** | Piper TTS | Generación de voz (más rápido, backup) |
| **8880** | Kokoro TTS | Generación de voz (alternativo) |
| **8090** | VibeVoice TTS | TTS realtime (Microsoft 0.5B, ~300ms) |
| **8091** | VibeVoice 7B TTS | TTS con voice cloning (Microsoft 7B) |
| **10301** | Voice Eval | Evalúa tu pronunciación |

### 💡 Analogía

Imagina que es un restaurante:

| Componente | Rol en el restaurante |
|------------|----------------------|
| **Navegador** | El cliente que hace el pedido |
| **Next.js (:9002)** | El mesero que recibe el pedido |
| **Cloud LLM API (:443)** | El chef que prepara la comida (piensa) |
| **VibeVoice 7B (:8091)** | El anfitrión que habla (voz con cloning) |
| **Voice Eval (:10301)** | El profesor que escucha tu práctica |

---

## 5. 🚀 Cómo Iniciar los Servicios

🎯 **Objetivo:** Levantar todos los servicios necesarios.

### Opción A: Manual (recomendado para desarrollo)

📋 **Pasos:**

```bash
# ===== TERMINAL 1: LM Studio =====

# 1. Abrir LM Studio
open -a "LM Studio"

# 2. En la pestaña de Modelos, buscar y cargar:
#    mistralai/voxtral-small-24b-2507

# 3. Click en "Start Server" (debe estar en el ícono de 🖥️)
#    Puerto: 1234
```

```bash
# ===== TERMINAL 2: Servicios de Voz =====

# 1. Activar conda
source ~/miniforge3/etc/profile.d/conda.sh

# 2. Iniciar Voxtral TTS
conda activate voxtral_audio
cd /ruta/a/genki
python audio_server.py &

# 3. Nueva terminal: Iniciar Piper TTS
conda activate genki
cd /ruta/a/genki/tts
python server.py &
```

```bash
# ===== TERMINAL 3: Aplicación Web =====

# 1. Ir al proyecto
cd /ruta/a/genki

# 2. Iniciar Next.js
npm run dev
```

🔍 **Verificación:** Abre http://localhost:9002 en tu navegador.

---

### Opción B: Automático (más fácil)

📋 **Pasos:**

```bash
# 1. Asegúrate que conda está activado
source ~/miniforge3/etc/profile.d/conda.sh

# 2. Ejecutar el script
./start-servers.sh start
```

🔍 **Verificación:** Verás mensajes como:
```
[INFO] Starting Voxtral TTS...
[INFO] Starting Piper TTS...
[INFO] Starting VibeVoice 7B TTS...
[INFO] Starting Voice Eval...
```

---

### 📋 Checklist de Servicios Activos

Para verificar que todo esté funcionando, ejecuta:

```bash
# Ver todos los puertos
lsof -i :8000 -i :8080 -i :8880 -i :8090 -i :8091 -i :9002 -i :10301
```

Deberías ver algo como:

```
COMMAND   PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node    12345  rafael    IPv4 0x...  localhost:9002 (LISTEN)
python  12346  rafael    IPv4 0x...  localhost:8000 (LISTEN)
python  12347  rafael    IPv4 0x...  localhost:8080 (LISTEN)
python  12348  rafael    IPv4 0x...  localhost:8880 (LISTEN)
python  12349  rafael    IPv4 0x...  localhost:8090 (LISTEN)
python  12350  rafael    IPv4 0x...  localhost:8091 (LISTEN)
python  12351  rafael    IPv4 0x...  localhost:10301 (LISTEN)
```

---

## 6. 💻 Uso de la Aplicación

🎯 **Objetivo:** Empezar a aprender idiomas.

### 🌐 Interfaz Principal

Abre en tu navegador: **http://localhost:9002**

Verás el menú principal con opciones:

| Opción | Descripción |
|--------|-------------|
| 📚 **Library** | Ver todos tus mazos de tarjetas |
| ✏️ **Creator** | Crear nuevas tarjetas desde texto |
| 🎯 **Study** | Estudiar con repetición espaciada |
| 🎤 **Voice Practice** | Practicar pronunciación |
| 💬 **Roleplay** | Conversar con un tutor de IA |
| ⚙️ **Settings** | Configurar voces, modelos, etc. |

### 📖 Flujo de Uso Básico

#### 1. Crear un Deck (Mazo)

1. Ve a **Library** 
2. Click en **+ Create New Deck**
3. Dale un nombre (ej: "Vocabulario Capítulo 1")
4. Ve a **Creator**
5. Pega texto en inglés
6. Click **Generate Cards**
7. ¡Listo! Las tarjetas se crean automáticamente

#### 2. Estudiar

1. Ve a **Library**
2. Click en un deck
3. Selecciona **Study** o **Voice Practice**
4. Responde las tarjetas
5. El sistema guarda tu progreso

---

## 7. ❓ Problemas Comunes

🎯 **Objetivo:** Solucionar errores sin frustración.

### 🔧 Problema 1: "Comando no encontrado"

**Síntoma:**
```bash
conda: command not found
```

**Solución:**
```bash
# Ejecutar esto cada vez que abras una terminal nueva:
source ~/miniforge3/etc/profile.d/conda.sh
```

**💡 Tip:** Para no hacerlo siempre, agrega esta línea al final de tu `~/.zshrc`:
```bash
echo 'source ~/miniforge3/etc/profile.d/conda.sh' >> ~/.zshrc
```

---

### 🔧 Problema 2: Puerto en uso

**Síntoma:**
```
Error: listen EADDRINUSE: address already in use :::9002
```

**Solución:**
```bash
# Encontrar qué está usando el puerto
lsof -i :9002

# Matar el proceso
kill -9 <PID>
```

---

### 🔧 Problema 3: LM Studio no responde

**Síntoma:**
```
Error: LM Studio connection failed
```

**Solución:**
1. ✅ Abre LM Studio
2. ✅ Carga un modelo (no solo lo descargues, ¡cárgalo!)
3. ✅ Click en "Start Server" (el botón de play/🚀)
4. ✅ Verifica que el puerto sea 1234

---

### 🔧 Problema 4: TTS no reproduce audio

**Síntoma:**
El botón de audio no funciona o da error.

**Solución:**
```bash
# Verificar que el servidor esté corriendo
curl http://localhost:8080/health
curl http://localhost:8000/health

# Si no responde, reiniciar:
# Para Piper (8080)
conda activate genki
cd tts
python server.py

# Para Voxtral (8000)
conda activate voxtral_audio
cd /ruta/a/genki
python audio_server.py
```

---

### 🔧 Problema 5: La app está lenta

**Síntoma:** Todo funciona pero el navegador va lento.

**Solución:**
1. Cierra pestañas del navegador que no uses
2. En LM Studio, usa un modelo más ligero (Q4 en vez de Q8)
3. Reduce el número de procesos en segundo plano

---

### 🔧 Problema 6: Error de memoria

**Síntoma:**
```
RuntimeError: CUDA out of memory
```

**Solución:**
1. Cierra LM Studio completamente
2. Recarga la página de Genki
3. Usa un modelo más pequeño

---

## 8. 📚 Vocabulario

🎯 **Objetivo:** Entender los términos técnicos.

| Término | Significado | En español |
|---------|-------------|------------|
| **TTS** | Text-to-Speech | Texto a voz |
| **SRS** | Spaced Repetition System | Sistema de repetición espaciada |
| **API** | Application Programming Interface | Interfaz de programación |
| **Port/Puerto** | Número que identifica un servicio | - |
| **localhost** | Tu propia computadora | 127.0.0.1 |
| **LLM** | Large Language Model | Modelo de lenguaje grande |
| **Voxtral** | Modelo de IA de Mistral para voz y texto | - |
| **Piper** | Modelo de TTS de código abierto | - |
| **conda** | Gestor de entornos Python | - |
| **npm** | Gestor de paquetes de Node.js | - |
| **venv/entorno** | Ambiente aislado de Python | - |
| **RAM** | Memoria de acceso aleatorio | Memoria principal |
| **GB** | Gigabytes (medida de almacenamiento) | - |

---

## ✅ Checklist Final

Antes de empezar a estudiar, verifica:

- [ ] Node.js instalado (`node --version`)
- [ ] Conda instalado (`conda --version`)
- [ ] LM Studio instalado y con modelo descargado
- [ ] Modelos de voz descargados en `tts/models/`
- [ ] Todos los servicios corriendo en los puertos correctos
- [ ] Puedes abrir http://localhost:9002

---

## 🎉 ¡Felicitaciones!

Si llegaste hasta aquí, **ya tienes todo funcionando**. 

Ahora puedes:
- ✨ Crear tarjetas de vocabulario desde cualquier texto
- 🃏 Estudiar con repetición espaciada
- 🎤 Practicar tu pronunciación
- 💬 Conversar con un tutor de IA

**¡Empieza a aprender!** 📚

---

*Documento creado para desarrolladores con perfil junior.  
Si tienes dudas, revisa la sección de [Problemas Comunes](#7❓-problemas-comunes) o consulta los archivos de código fuente.*
