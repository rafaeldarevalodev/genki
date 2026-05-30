/**
 * Voice Event Bus — WebSocket client for Redis Pub/Sub bridge
 *
 * Connects to genki-api WebSocket endpoint which bridges
 * Redis Pub/Sub events from the voice pipeline.
 *
 * Event channel per session: `genki:session:{sessionId}`
 */
import type { VoiceEvent, TTSChunkEvent, TranscriptionEvent, MayaResponseEvent, StatusEvent, VADEvent } from '@/types/voice'

export type VoiceEventHandler = (event: VoiceEvent) => void

export interface VoiceBusOptions {
  baseUrl?: string
  sessionId: string
  onTranscription?: (text: string) => void
  onMayaResponse?: (text: string) => void
  onTTSChunk?: (chunk: TTSChunkEvent['data']) => void
  onStatusChange?: (stage: StatusEvent['data']['stage']) => void
  onVAD?: (detected: boolean) => void
  onEnd?: () => void
  onError?: (error: string) => void
  onBargeIn?: () => void
}

export class VoiceEventBus {
  private ws: WebSocket | null = null
  private sessionId: string
  private handlers: Map<VoiceEventType, Set<VoiceEventHandler>> = new Map()
  private opts: VoiceBusOptions
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3
  private reconnectDelay = 1000

  constructor(opts: VoiceBusOptions) {
    this.sessionId = opts.sessionId
    this.opts = opts
  }

  connect(): void {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const baseUrl = this.opts.baseUrl ?? `${protocol}//${window.location.host}`
    const url = `${baseUrl}/ws/voice/${this.sessionId}`

    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.reconnectAttempts = 0
    }

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as VoiceEvent
        this.dispatch(msg)
      } catch (err) {
        console.error('[VoiceBus] Failed to parse message:', err)
      }
    }

    this.ws.onerror = (err) => {
      console.error('[VoiceBus] WebSocket error:', err)
    }

    this.ws.onclose = () => {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++
        setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts)
      }
    }
  }

  private dispatch(event: VoiceEvent): void {
    // Typed callbacks
    switch (event.type) {
      case 'transcription':
        this.opts.onTranscription?.((event as TranscriptionEvent).data.text)
        break
      case 'maya_response':
        this.opts.onMayaResponse?.((event as MayaResponseEvent).data.text)
        break
      case 'audio_chunk':
        this.opts.onTTSChunk?.((event as TTSChunkEvent).data)
        break
      case 'status':
        this.opts.onStatusChange?.((event as StatusEvent).data.stage)
        break
      case 'vad':
        this.opts.onVAD?.((event as VADEvent).data.detected)
        break
      case 'end':
        this.opts.onEnd?.()
        break
      case 'error':
        this.opts.onError?.(event.data.message as string)
        break
      case 'barge_in':
        this.opts.onBargeIn?.()
        break
    }

    // Generic handlers
    const handlers = this.handlers.get(event.type)
    handlers?.forEach((h) => h(event))
  }

  on(type: VoiceEventType, handler: VoiceEventHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add(handler)
  }

  off(type: VoiceEventType, handler: VoiceEventHandler): void {
    this.handlers.get(type)?.delete(handler)
  }

  sendAudio(base64Audio: string, metadata?: Record<string, unknown>): void {
    this.ws?.send(JSON.stringify({
      type: 'audio',
      data: { audio: base64Audio, ...metadata },
    }))
  }

  abort(): void {
    this.ws?.send(JSON.stringify({ type: 'abort' }))
  }

  disconnect(): void {
    this.ws?.close()
    this.ws = null
  }
}
