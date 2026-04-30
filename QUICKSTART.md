# Quick Start Guide <!-- omit in toc -->

## Requisitos

- macOS (Apple Silicon recomendado)
- Node.js 20+
- Python 3.11+
- Conda (Miniforge3)
- LM Studio (para modelos IA)

## instalación Rápida

```bash
# 1. Clonar repositorio
git clone https://github.com/tu-usuario/genki.git
cd genki

# 2. Ejecutar setup completo
./setup.sh
```

Esto automáticamente:
- ✅ Instala dependencias Node
- ✅ Crea entornos Conda (genki, voxtral_audio)
- ✅ Descarga modelos TTS
- ✅-compila la app
- ✅ Inicia servidores

## Quick Commands

```bash
# Iniciar servidores (sin descargar nada)
./start-servers.sh start

# Ver estado
./start-servers.sh status

# Ver ayuda
./start-servers.sh
```

##puertos

| Servicio | Puerto | URL Health |
|----------|--------|-----------|
| Next.js | 9002 | - |
| Voxtral TTS | 8000 | `/health` |
| Piper TTS | 8080 | `/health` |
| LM Studio | 1234 | `/v1/models` |

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

# Production build
npm run build && npm start
```

## Más Info

Ver [README.md](./README.md) para manual completo.