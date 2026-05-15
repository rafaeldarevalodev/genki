# Genki Sensei - Manual de Instalación 🚀

> **Para:** Perfil Junior  
> **Nivel de dificultad:** Principiante a Intermedio  
> **Tiempo estimado:** 30-60 minutos

---

## 📖 Tabla de Contenidos

1. [¿Qué es Genki Sensei?](#1-qué-es-genki-sensei)
2. [🧰 Requisitos del Sistema](#2🧰-requisitos-del-sistema)
3. [📦 Instalación Paso a Paso](#3📦-instalación-paso-a-paso)
4. [🚀 Cómo Iniciar los Servicios](#4🚀-cómo-iniciar-los-servicios)
5. [💻 Uso de la Aplicación](#5💻-uso-de-la-aplicación)
6. [❓ Problemas Comunes](#6❓-problemas-comunes)

---

## 1. ¿Qué es Genki Sensei?

🎯 **Objetivo:** Entender qué vamos a construir.

Genki Sensei es una **aplicación web para aprender idiomas** que usa Inteligencia Artificial en la nube para generar contenido de aprendizaje.

### ✨ Características Principales

| Característica | Descripción |
|---------------|-------------|
| 🃏 **Flashcards Inteligentes** | Crea tarjetas de vocabulario desde cualquier texto |
| 🎯 **Repetición Espaciada (SRS)** | El sistema te muestra las palabras justo cuando las vas a olvidar |
| 🗣️ **Práctica de Voz** | Graba tu pronunciación y la IA te evalúa |
| 💬 **Roleplay** | Practica conversaciones con Maya (tutor de inglés) |
| 🎙️ **Live Voice** | Conversación inmersiva con voz en tiempo real |
| 🔊 **Text-to-Speech (TTS)** | Escucha la pronunciación correcta |

### 💡 ¿Por qué es especial?

- **Cloud LLM** - Usa IA en la nube (Groq/Mistral) para mejor rendimiento
- **TTS Local** - Servidores de voz corriendo en tu computadora
- **Gratis** - Sin suscripciones
- **Privado** - Tus datos de estudio son locales

---

## 2. 🧰 Requisitos del Sistema

### Hardware Mínimo

| Componente | Mínimo | Recomendado |
|------------|--------|-------------|
| 💾 **Almacenamiento** | 10 GB libres | 20 GB libres |
| 🧠 **RAM** | 8 GB | 16 GB |
| 🍎 **Sistema** | macOS | macOS con chip M1/M2/M3/M4 |

### Software Necesario

| Software | Para qué sirve | ¿Cómo obtenerlo? |
|----------|----------------|------------------|
| **macOS** | Sistema operativo | Ya lo tienes si usas Mac |
| **Node.js** | Ejecutar la aplicación web | Se instala más adelante |
| **Conda (Miniforge)** | Gestionar entornos de Python | Se instala más adelante |

---

## 3. 📦 Instalación Paso a Paso

### 3.1 Instalar Node.js

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

🔍 **Verificación:** El comando debe mostrar `v20.x.x`

---

### 3.2 Instalar Conda (Miniforge)

```bash
# 1. Descargar Miniforge para Mac
cd ~/Downloads
curl -L -O https://github.com/conda-conda/conda/releases/latest/download/Miniforge3-MacOSX-arm64.sh

# 2. Instalar
bash Miniforge3-MacOSX-arm64.sh

# 3. Aceptar todas las preguntas (presiona Enter)
# Cuando pregunte "¿Do you wish the installer to initialize Miniforge3?", escribe "yes"

# 4. Cerrar y abrir terminal, o ejecutar:
source ~/miniforge3/etc/profile.d/conda.sh

# 5. Verificar
conda --version
```

---

### 3.3 Descargar e Instalar el Proyecto

**Paso 1:** Clonar o descargar el proyecto desde GitHub

**Paso 2:** Abrir terminal y entrar al directorio del proyecto:
```text
cd genki
```

**Paso 3:** Crear entornos de Python:
```text
conda env create -f environment.yml
```

**Paso 4:** Instalar dependencias de Node:
```text
npm install
```

**Paso 5:** Ejecutar la instalación completa:
```text
./setup.sh full
```

---

### 3.4 Configurar API de LLM (Opcional)

Genki usa **LLM en la nube** por defecto. Para activar:

**Paso 1:** Crear archivo `.env.local` en la raíz del proyecto:
```text
LLM_PROVIDER=cloud
CLOUD_MODEL=moonshotai/kimi-k2.6
CLOUD_API_KEY=tu-api-key
CLOUD_BASE_URL=https://api.nvidia.com/v1/experimental/mistral-ai/codestral-latest
```

**Paso 2:** Obtener una API key de NVIDIA API:
- Ir a https://api.nvidia.com/
- Crear una cuenta
- Copiar la API key

---

## 4. 🚀 Cómo Iniciar los Servicios

### Opción Automática (Recomendado)

```text
./genki.sh start
```

Esto inicia todos los servicios necesarios:
- Piper TTS (8080)
- Kokoro TTS (8880)
- VibeVoice 7B TTS (8091)
- Maya Live Voice (8092)
- Voice Eval (10301)
- Next.js (9002)

🔍 **Verificación:** Abre http://localhost:9002 en tu navegador.

---

### Comandos Útiles

| Qué quieres hacer | Copia y pega este comando |
|-------------------|--------------------------|
| **Iniciar todo** | `./genki.sh start` |
| **Ver qué está corriendo** | `./genki.sh status` |
| **Detener todos los servicios** | `./genki.sh stop` |
| **Reiniciar todo** | `./genki.sh restart` |

---

### Puertos que usa Genki

| Servicio | Puerto |
|----------|--------|
| App web | 9002 |
| Piper TTS | 8080 |
| Kokoro TTS | 8880 |
| VibeVoice 7B TTS | 8091 |
| Maya Live Voice | 8092 |
| Voice Eval | 10301 |

---

## 5. 💻 Uso de la Aplicación

### 🌐 Interfaz Principal

Abre en tu navegador: **http://localhost:9002**

Verás el menú principal con opciones:

| Opción | Descripción |
|--------|-------------|
| 📚 **Library** | Ver todos tus mazos de tarjetas |
| ✏️ **Creator** | Crear nuevas tarjetas desde texto |
| 🎯 **Study** | Estudiar con repetición espaciada |
| 🎤 **Voice Practice** | Practicar pronunciación |
| 💬 **Roleplay** | Conversar con Maya (tutor de inglés) |
| ⚙️ **Settings** | Configurar voces, modelos, etc. |

### 📖 Flujo de Uso Básico

#### 1. Crear un Deck (Mazo)

1. Ve a **Library** 
2. Click en **+ Create New Deck**
3. Dale un nombre (ej: "Vocabulario Capítulo 1")
4. Ve a **Creator**
5. Pega texto en inglés
6. Selecciona modo: **Words** (vocabulario individual) o **Chunks** (frases)
7. Click **Generate Cards**
8. ¡Listo! Las tarjetas se crean automáticamente

#### 2. Estudiar

1. Ve a **Library**
2. Click en un deck
3. Selecciona **Study** o **Voice Practice**
4. Responde las tarjetas
5. El sistema guarda tu progreso

---

## 6. ❓ Problemas Comunes

### 🔧 Problema 1: "Comando no encontrado"

**Síntoma:**
```text
conda: command not found
```

**Solución:**
```text
source ~/miniforge3/etc/profile.d/conda.sh
```

---

### 🔧 Problema 2: Puerto en uso

**Síntoma:**
```
Error: listen EADDRINUSE: address already in use :::9002
```

**Solución:**
```text
./genki.sh restart
```

---

### 🔧 Problema 3: TTS no funciona

**Síntoma:**
El botón de audio no funciona o da error.

**Solución:**
```text
./genki.sh restart
```

---

### 🔧 Problema 4: API de LLM no responde

**Síntoma:**
Error al generar tarjetas.

**Solución:**
1. Verificar que `.env.local` tiene la API key correcta
2. Verificar conexión a internet
3. Verificar que NVIDIA API está disponible

---

## ✅ Checklist Final

Antes de empezar a estudiar, verifica:

- [ ] Node.js instalado (`node --version`)
- [ ] Conda instalado (`conda --version`)
- [ ] `./genki.sh start` funciona
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

*Documento creado para desarrolladores con perfil junior.*