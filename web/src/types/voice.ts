// Voice pipeline event types — mirror backend Redis Pub/Sub channels
export type VoiceEventType =
  | 'user_speech_started'
  | 'transcription_complete'
  | 'llm_response_started'
  | 'tts_chunk_sent'
  | 'barge_in'
  | 'end'
  | 'error'
  | 'status'
  | 'vad'

export interface VoiceEvent {
  type: VoiceEventType
  data: Record<string, unknown>
  timestamp?: number
}

export interface TranscriptionEvent {
  type: 'transcription'
  data: { text: string }
}

export interface MayaResponseEvent {
  type: 'maya_response'
  data: { text: string }
}

export interface TTSChunkEvent {
  type: 'audio_chunk'
  data: {
    data: string // base64 PCM
    sample_rate: number
    compressed: boolean
    download_url?: string
    chunk_index?: number
    total_chunks?: number
  }
}

export interface StatusEvent {
  type: 'status'
  data: { stage: 'idle' | 'listening' | 'transcribing' | 'maya_thinking' | 'speaking' }
}

export interface VADEvent {
  type: 'vad'
  data: { detected: boolean }
}

export type VadState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error'

export interface VoiceSession {
  id: string
  vadState: VadState
  userTranscript: string
  mayaTranscript: string
  isMayaSpeaking: boolean
  error: string | null
  audioDownloadUrl: string | null
}

export interface ConversationMessage {
  id: string
  role: 'user' | 'maya'
  text: string
  audioUrl?: string
  timestamp: number
}
