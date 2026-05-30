import { useRef, useCallback, useEffect } from 'react'
import { VoiceEventBus } from '@/services/voiceBus'
import { useVoiceStore, useSettingsStore } from '@/services/store'
import type { TTSChunkEvent } from '@/types/voice'

export function useVoice() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const workerRef = useRef<Worker | null>(null)
  const busRef = useRef<VoiceEventBus | null>(null)

  const {
    sessionId,
    setSessionId,
    vadState,
    setVadState,
    setUserTranscript,
    setMayaTranscript,
    setMayaSpeaking,
    setError,
    updateLastMessageAudio,
    resetSession,
    addMessage,
  } = useVoiceStore()

  const { settings } = useSettingsStore()

  // Initialize audio playback worker
  useEffect(() => {
    workerRef.current = new Worker(
      new URL('@/workers/audioStream.worker.ts', import.meta.url),
      { type: 'module' }
    )
    return () => workerRef.current?.terminate()
  }, [])

  const createSession = useCallback(() => {
    const id = crypto.randomUUID()
    setSessionId(id)
    return id
  }, [setSessionId])

  const handleTTSChunk = useCallback((chunk: TTSChunkEvent['data']) => {
    if (workerRef.current) {
      workerRef.current.postMessage({
        type: 'chunk',
        data: {
          data: chunk.data,
          sample_rate: chunk.sample_rate,
          compressed: chunk.compressed,
          chunk_index: chunk.chunk_index,
          total_chunks: chunk.total_chunks,
        },
      })
    }
    if (chunk.download_url) {
      updateLastMessageAudio(chunk.download_url)
    }
  }, [updateLastMessageAudio])

  const startBus = useCallback((sid: string) => {
    busRef.current = new VoiceEventBus({
      sessionId: sid,
      onTranscription: (text) => {
        setUserTranscript(text)
        addMessage({ role: 'user', text })
      },
      onMayaResponse: (text) => {
        setMayaTranscript(text)
        addMessage({ role: 'maya', text })
      },
      onTTSChunk: handleTTSChunk,
      onStatusChange: (stage) => {
        if (stage === 'speaking') setMayaSpeaking(true)
        else setMayaSpeaking(false)
      },
      onVAD: (detected) => {
        setVadState(detected ? 'listening' : 'idle')
      },
      onEnd: () => {
        setVadState('idle')
        setMayaSpeaking(false)
      },
      onError: (error) => {
        setError(error)
        setVadState('error')
      },
      onBargeIn: () => {
        workerRef.current?.postMessage({ type: 'abort' })
        setVadState('idle')
        setMayaSpeaking(false)
      },
    })
    busRef.current.connect()
  }, [setUserTranscript, setMayaTranscript, setMayaSpeaking, setVadState, setError, addMessage, handleTTSChunk])

  const startListening = useCallback(async () => {
    const sid = sessionId ?? createSession()
    if (!sessionId) startBus(sid)

    resetSession()
    setVadState('listening')
    setError(null)

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus',
    })
    mediaRecorderRef.current = mediaRecorder
    audioChunksRef.current = []

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data)
      }
    }

    mediaRecorder.onstop = async () => {
      setVadState('processing')
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      const arrayBuffer = await blob.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

      busRef.current?.sendAudio(base64, {
        tts_provider: settings.ttsProvider,
        tts_voice: settings.voiceId,
        speed: settings.speed,
      })
    }

    mediaRecorder.start(100)

    // 5s max recording
    setTimeout(() => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
    }, 5000)
  }, [sessionId, createSession, startBus, resetSession, setVadState, setError, settings])

  const interrupt = useCallback(() => {
    workerRef.current?.postMessage({ type: 'abort' })
    mediaRecorderRef.current?.state === 'recording' && mediaRecorderRef.current.stop()
    busRef.current?.abort()
    setVadState('idle')
    setMayaSpeaking(false)
  }, [setVadState, setMayaSpeaking])

  useEffect(() => {
    return () => {
      busRef.current?.disconnect()
    }
  }, [])

  return {
    vadState,
    sessionId,
    startListening,
    interrupt,
  }
}
