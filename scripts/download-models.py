#!/usr/bin/env python3
"""
Script para descargar modelos de TTS automaticamente.
Ejecutar: python scripts/download-models.py
"""

import os
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent.resolve()
MODELS_DIR = SCRIPT_DIR / "models"
TTS_MODELS_DIR = SCRIPT_DIR / "tts" / "models"

# Repo de Voxtral TTS en HuggingFace
VOXTRAL_TTS_REPO = "mlx-community/Voxtral-4B-TTS-2603-mlx-4bit"

def ensure_huggingface_cli():
    """Instala huggingface_hub si no existe"""
    try:
        from huggingface_hub import snapshot_download
        return snapshot_download
    except ImportError:
        print("Instalando huggingface_hub...")
        os.system(f"{sys.executable} -m pip install huggingface_hub -q")
        from huggingface_hub import snapshot_download
        return snapshot_download

def download_voxtral_tts():
    """Descarga Voxtral TTS si no existe"""
    model_path = MODELS_DIR / "Voxtral-4B-TTS"
    
    if model_path.exists():
        print(f"✓ Voxtral TTS ya existe en {model_path}")
        return
    
    print(f"Descargando Voxtral TTS desde HuggingFace...")
    print(f"Repo: {VOXTRAL_TTS_REPO}")
    print("Esto puede tomar varios minutos...")
    
    try:
        snapshot_download = ensure_huggingface_cli()
        
        snapshot_download(
            repo_id=VOXTRAL_TTS_REPO,
            local_dir=str(model_path),
            ignore_patterns=[".git*", "*.gitkeep"]
        )
        print(f"✓ Voxtral TTS descargado en {model_path}")
    except Exception as e:
        print(f"✗ Error descargando: {e}")
        print("Puedes descargar manualmente desde:")
        print(f"  https://huggingface.co/{VOXTRAL_TTS_REPO}")
        sys.exit(1)

def download_piper_models():
    """Descarga modelos de Piper (opcional)"""
    # Los modelos de Piper son pequeños (~50MB cada uno)
    # Puedes descargarlos manualmente desde:
    # https://github.com/rhasspy/piper/tree/master/src/python_run
    # 
    # O usar el script oficial:
    # bash <(curl -s https://rhasspy.github.io/piper/../../share/piper/download.sh)
    pass

def main():
    print("=== Genki Sensei - Download Models ===")
    print()
    print("Buscando modelos...")
    
    # Descargar Voxtral
    download_voxtral_tts()
    
    print()
    print("=== Descarga completa ===")

if __name__ == "__main__":
    main()