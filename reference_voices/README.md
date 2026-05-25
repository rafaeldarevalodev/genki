# Voice Reference Files for Maya

Place `maya_ref.wav` here for voice cloning (optional).

Requirements:
- Format: WAV, mono, 24kHz
- Duration: 5-10 seconds
- Content: Clear speech in English

Without this file, Maya will use a default female voice (af_bella from Kokoro).

---

## How to Add a New Voice for F5-TTS / VibeVoice 7B

### 1. Extract Audio from Source

Extract 10 seconds of audio from your source audio file (MP3, etc.):

```bash
ffmpeg -y -i <source_audio.mp3> -ss <start_seconds> -t 10 -ar 24000 -ac 1 reference_voices/<voice_name>.wav
```

Example (extract from 1:13 to 1:23):
```bash
ffmpeg -y -i complete_audio_reference.mp3 -ss 73 -t 10 -ar 24000 -ac 1 reference_voices/en_Giuseppe_man.wav
```

Parameters:
- `-ss <seconds>`: Start time in seconds
- `-t 10`: Duration (10 seconds)
- `-ar 24000`: Sample rate (24kHz - required by F5-TTS/VibeVoice)
- `-ac 1`: Mono channel
- `-y`: Overwrite existing file

### 2. Create Transcription File

Use the included script with **whisper-large-v3** for maximum accuracy (especially for names and proper nouns):

```bash
source ~/.zshrc && conda run -n genki python3 transcribe_reference.py en_Mark_Eng.wav
```

Or transcribe all WAV files at once:
```bash
source ~/.zshrc && conda run -n genki python3 transcribe_reference.py
```

This creates a `.txt` file with the same name as the WAV file:
```bash
# reference_voices/en_Giuseppe_man.wav
# reference_voices/en_Giuseppe_man.txt (generated automatically)
```

> **Important**: Accurate transcription is critical for F5-TTS. If the text doesn't match the audio exactly, the model will hallucinate and repeat the reference text.

### 3. Update Server Files

#### maya_live_server.py
Add to:
- `DEFAULT_VOICES`: `"en-VoiceName_gender"`
- `VOICE_ID_TO_FILE`: `"en-VoiceName_gender": "en_VoiceName_gender.wav"`
- `VOICE_ID_TO_REF_TEXT`: `"en-VoiceName_gender": "<transcription>"`

#### vibevoice7b_server.py
Add to:
- `DEFAULT_VOICES`: `"en-VoiceName_gender"`
- `VOICE_TO_REFERENCE`: `"en-VoiceName_gender": "en_VoiceName_gender.wav"`

### 4. Update Frontend UI

#### src/components/settings-modal.tsx
Add to:
- `vibevoice7bVoices`: `{ id: 'en-VoiceName_gender', name: 'Name (Gender)', accent: 'Custom', source: 'preset' }`
- `mayaVoices`: `{ id: 'en-VoiceName_gender', name: 'Name (Gender)', accent: 'Custom' }`

### 5. Rebuild the App

```bash
npm run build
```

---

## Voice Naming Convention

Use format: `en_<Name>_<gender>.wav`

Examples:
- `en_Giuseppe_man.wav` - Male voice
- `en_Lady_female.wav` - Female voice
- `en_Andi_Male.wav` - Male voice

---

## Voice Files List

| Voice ID | Audio File | Transcription File |
|----------|------------|-------------------|
| en-Giuseppe_man | en_Giuseppe_man.wav | en_Giuseppe_man.txt |
| en-Andi_Male | en_Andi_Male.wav | en_Andi_Male.txt |
| en-Lady_female | en_Lady_female.wav | en_Lady_female.txt |
| en-Hanel_male | en_Hanel_male.wav | en_Hanel_male.txt |
| en-Mark_Eng | en_Mark_Eng.wav | en_Mark_Eng.txt |