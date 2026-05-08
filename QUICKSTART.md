# Quick Start Guide <!-- omit in toc -->

## Requisitos

- macOS (Apple Silicon recomendado)
- Node.js 20+
- Python 3.11+
- Conda (Miniforge3)
- LM Studio (para modelos IA locales, opcional)

## Instalación Rápida

```bash
# 1. Clonar repositorio
git clone https://github.com/tu-usuario/genki.git
cd genki

# 2. Crear entornos Conda
conda env create -f environment.yml

# 3. Instalar dependencias Node
npm install
```

## Inicio Rápido

```bash
# 1. Activar conda
source ~/miniforge3/etc/profile.d/conda.sh

# 2. Iniciar servidores TTS
./start-servers.sh start

# 3. Iniciar Genki
npm run dev
# App: http://localhost:9002
```

**Modo cloud (sin LM Studio):**
```bash
# Editar .env.local y configurar:
# LLM_PROVIDER=cloud
# CLOUD_API_KEY=tu-api-key
```

## Comandos

```bash
# Iniciar todos los servidores
./start-servers.sh start

# Ver estado
./start-servers.sh status

# Reiniciar
./start-servers.sh restart

# Detener
./start-servers.sh stop
```

## Puertos

| Servicio | Puerto | Health URL |
|----------|--------|-----------|
| Next.js | 9002 | - |
| Voxtral TTS | 8000 | `/health` |
| Piper TTS | 8080 | `/health` |
| VibeVoice TTS | 8090 | `/health` |
| Kokoro TTS | 8880 | `/health` |
| Voice Eval | 10301 | `/health` |
| LM Studio | 1234 | `/v1/models` |

## Features TTS

| Proveedor | Puerto | Modelo | Latencia | Voces |
|----------|--------|--------|----------|-------|
| Voxtral | 8000 | Voxtral-4B | ~2s | 5 |
| VibeVoice | 8090 | VibeVoice-0.5B | ~300ms | 10 |
| Kokoro | 8880 | Kokoro-7B | ~1s | 10+ |
| Piper | 8080 | Piper | ~0.5s | 3 |

## Problemas Comunes

### Error: `EADDRINUSE`
```bash
./start-servers.sh restart
```

### Modelos no descargan
```bash
python scripts/download-models.py
```

### LM Studio no responde
1. Abrir LM Studio
2. Cargar modelo (ej: Voxtral Small)
3. Click "Start Server"

## Desarrollo

```bash
# Modo desarrollo
npm run dev

# Type check
npm run typecheck

# Lint
npm run lint

# Production build
npm run build && npm start
```

## Más Info

Ver [README.md](./README.md) para manual completo.
