# Quick Start Guide

## Requisitos

- macOS (Apple Silicon recomendado)
- Node.js 20+
- Python 3.11+
- Conda (Miniforge3)

## Instalación (Primera vez)

**Paso 1:** Clonar o descargar el proyecto

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

## Uso Diario

**Paso 1:** Abrir terminal

**Paso 2:** Entrar al directorio del proyecto:
```text
cd genki
```

**Paso 3:** Iniciar Genki:
```text
./genki.sh start
```

**Paso 4:** Abrir tu navegador y escribir:
```text
http://localhost:9002
```

---

## Comandos

Copia y pega estos comandos en tu terminal según lo que necesites:

| Qué quieres hacer | Copia y pega este comando |
|-------------------|--------------------------|
| **Iniciar todo** | `./genki.sh start` |
| **Iniciar solo TTS (sin app)** | `./genki.sh start --dev` |
| **Ver qué está corriendo** | `./genki.sh status` |
| **Detener todos los servicios** | `./genki.sh stop` |
| **Reiniciar todo** | `./genki.sh restart` |

---

## Servicios de Voz (TTS)

Genki usa 3 motores de voz:

| Servicio | Puerto | Calidad | Voice Cloning |
|----------|--------|---------|---------------|
| **Piper** | 8080 | Rápido | No |
| **Kokoro** | 8880 | Buena | No |
| **VibeVoice 7B** | 8091 | La mejor | Sí |

---

## Si algo no funciona

### Los servicios no inician
Copia y pega:
```text
./genki.sh restart
```

### Ver los logs
Copia y pega en terminal (cada uno en una terminal diferente):

```text
tail -f /tmp/pipeline.log
```

```text
tail -f /tmp/nextjs.log
```

---

## Para desarrollo

Si estás modificando el código:

1. Copia y pega: `./genki.sh start --dev`
2. En otra terminal, copia y pega: `npm run dev`

---

Para más información, ver [README.md](./README.md)