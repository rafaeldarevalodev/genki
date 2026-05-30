import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { Mic, MicOff, Square, Zap, Sparkles, ChevronDown, Activity, Wifi, WifiOff } from 'lucide-react'
import { useVoice } from '@/hooks/useVoice'
import { useVoiceStore } from '@/services/store'

// ─── Latency Masking Skeleton ────────────────────────────────────────────────

function TypingIndicator() {
  const dots = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dots.current) return
    gsap.set(dots.current.children, { opacity: 0.3, y: 2 })

    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.3 })
    tl.to(dots.current.children, {
      opacity: 1,
      y: 0,
      duration: 0.2,
      stagger: 0.1,
      ease: 'power2.out',
    })
      .to(dots.current.children, {
        opacity: 0.3,
        y: 2,
        duration: 0.2,
        stagger: 0.05,
        ease: 'power2.in',
      })

    return () => { tl.kill() }
  }, [])

  return (
    <div ref={dots} className="flex items-center gap-1 px-3 py-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-genki-400"
        />
      ))}
    </div>
  )
}

// ─── Waveform Visualizer Modes ───────────────────────────────────────────────

function Waveform({ mode }: { mode: 'idle' | 'listening' | 'processing' | 'speaking' }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const barsRef = useRef<HTMLDivElement[]>([])

  const barCount = 12
  const colors: Record<string, string> = {
    idle: 'bg-obsidian-600',
    listening: 'bg-genki-400',
    processing: 'bg-coral-400',
    speaking: 'bg-genki-300',
  }

  useEffect(() => {
    if (!containerRef.current) return

    if (mode === 'idle') {
      gsap.to(barsRef.current, {
        scaleY: 0.15,
        duration: 0.4,
        ease: 'power2.out',
        stagger: { each: 0.03, from: 'random' },
      })
    }

    if (mode === 'listening') {
      barsRef.current.forEach((bar) => {
        gsap.to(bar, {
          scaleY: () => Math.random() * 0.7 + 0.3,
          duration: 0.12,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
          delay: Math.random() * 0.3,
        })
      })
    }

    if (mode === 'processing') {
      barsRef.current.forEach((bar) => {
        gsap.to(bar, {
          scaleY: () => Math.random() * 0.4 + 0.1,
          duration: 0.2 + Math.random() * 0.3,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
          delay: Math.random() * 0.5,
        })
      })
    }

    if (mode === 'speaking') {
      // Ripple effect outward
      gsap.to(barsRef.current, {
        scaleY: (i) => {
          const center = Math.abs(i - barCount / 2) / (barCount / 2)
          return 0.3 + (1 - center) * 0.7
        },
        duration: 0.3,
        ease: 'elastic.out(1, 0.5)',
        stagger: { each: 0.04, from: 'center' },
      })
    }

    return () => { gsap.killTweensOf(barsRef.current) }
  }, [mode])

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center gap-1 h-14 px-4"
    >
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          ref={(el) => { if (el) barsRef.current[i] = el }}
          className={`w-1.5 rounded-full transition-colors duration-300 ${colors[mode]}`}
          style={{ height: '20%', transform: 'scaleY(0.15)', transformOrigin: 'center' }}
        />
      ))}
    </div>
  )
}

// ─── System Health ───────────────────────────────────────────────────────────

interface ServiceStatus {
  name: string
  status: 'ok' | 'error' | 'pending'
  latency?: number
}

function SystemHealth() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [services, setServices] = useState<ServiceStatus[]>([])
  const panelRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const checkHealth = useCallback(async () => {
    setLoading(true)
    setServices([])
    try {
      const res = await fetch('/api/health')
      const data = await res.json()

      const mapped: ServiceStatus[] = [
        { name: 'genki-api', status: res.ok ? 'ok' : 'error', latency: 0 },
        { name: 'redis', status: data.redis === 'ok' ? 'ok' : 'error' },
        { name: 'voice', status: data.voice === 'ok' ? 'ok' : 'error' },
        { name: 'llm', status: data.llm === 'ok' ? 'ok' : 'error' },
        { name: 'vector', status: data.vector === 'ok' ? 'ok' : 'error' },
      ]

      setServices(mapped)
    } catch {
      setServices([
        { name: 'genki-api', status: 'error' },
        { name: 'redis', status: 'pending' },
        { name: 'voice', status: 'pending' },
        { name: 'llm', status: 'pending' },
        { name: 'vector', status: 'pending' },
      ])
    } finally {
      setLoading(false)
    }
  }, [])

  // Animate panel open/close
  useEffect(() => {
    if (!panelRef.current) return
    if (open) {
      gsap.fromTo(panelRef.current,
        { opacity: 0, y: -8, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.2, ease: 'back.out(1.4)' }
      )
      checkHealth()
    } else {
      gsap.to(panelRef.current, {
        opacity: 0, y: -8, scale: 0.96, duration: 0.15, ease: 'power2.in'
      })
    }
  }, [open, checkHealth])

  const allOk = services.length > 0 && services.every((s) => s.status === 'ok')

  return (
    <div className="absolute top-2 right-2 z-30">
      {/* Toggle button */}
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className={`
          w-7 h-7 rounded-full flex items-center justify-center
          transition-all duration-200 cursor-pointer
          ${allOk ? 'bg-emerald-500/20 text-emerald-400' : 'bg-obsidian-700 text-obsidian-400'}
          ${open ? 'ring-2 ring-genki-500/40' : 'hover:bg-obsidian-600'}
        `}
        title="System Health"
      >
        {allOk ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
      </button>

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-9 w-52 genki-glass rounded-xl p-4 shadow-xl"
          style={{ opacity: 0 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-3.5 h-3.5 text-genki-400" />
            <span className="text-xs font-mono text-obsidian-300 uppercase tracking-widest">
              System Health
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-3">
              <div className="w-4 h-4 border-2 border-genki-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {services.map((s) => (
                <div key={s.name} className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-obsidian-400">{s.name}</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`
                        w-1.5 h-1.5 rounded-full
                        ${s.status === 'ok' ? 'bg-emerald-400' : s.status === 'error' ? 'bg-coral-400' : 'bg-amber-400'}
                      `}
                    />
                    <span
                      className={`
                        text-[10px] font-mono
                        ${s.status === 'ok' ? 'text-emerald-400' : s.status === 'error' ? 'text-coral-400' : 'text-amber-400'}
                      `}
                    >
                      {s.status === 'ok' ? 'up' : s.status === 'error' ? 'down' : '...'}
                    </span>
                  </div>
                </div>
              ))}

              {!services.length && (
                <p className="text-[10px] font-mono text-obsidian-600 italic text-center py-2">
                  Click to check
                </p>
              )}
            </div>
          )}

          <button
            onClick={checkHealth}
            className="mt-3 w-full text-[10px] font-mono text-obsidian-600 hover:text-genki-400 transition-colors text-center py-1 border-t border-obsidian-700/50 pt-2"
          >
            ↻ Refresh
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Audio Ring ──────────────────────────────────────────────────────────────

function AudioRing({ active }: { active: boolean }) {
  const ringsRef = useRef<HTMLDivElement[]>([])

  useEffect(() => {
    if (!active) {
      gsap.killTweensOf(ringsRef.current)
      gsap.set(ringsRef.current, { scale: 1, opacity: 0 })
      return
    }

    ringsRef.current.forEach((ring, i) => {
      gsap.fromTo(
        ring,
        { scale: 1, opacity: 0.5 },
        {
          scale: 1.8,
          opacity: 0,
          duration: 1.5,
          ease: 'power2.out',
          repeat: -1,
          delay: i * 0.5,
        }
      )
    })
  }, [active])

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          ref={(el) => { if (el) ringsRef.current[i] = el }}
          className="absolute w-28 h-28 rounded-full border border-genki-400/40"
          style={{ scale: 1, opacity: 0 }}
        />
      ))}
    </div>
  )
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

interface MessageBubbleProps {
  role: 'user' | 'maya'
  text: string
  audioUrl?: string
  isNew?: boolean
}

function MessageBubble({ role, text, audioUrl, isNew }: MessageBubbleProps) {
  const bubbleRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!bubbleRef.current || !isNew) return

    gsap.from(bubbleRef.current, {
      opacity: 0,
      x: role === 'user' ? 20 : -20,
      duration: 0.4,
      ease: 'back.out(1.4)',
    })
  }, [isNew, role])

  return (
    <div
      ref={bubbleRef}
      className={`
        msg-entry flex items-end gap-2 max-w-[85%]
        ${role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}
      `}
    >
      <div
        className={`
          w-7 h-7 rounded-xl flex items-center justify-center shrink-0
          ${role === 'user' ? 'bg-obsidian-700' : 'bg-genki-500/15'}
        `}
      >
        {role === 'user' ? (
          <Mic className="w-3.5 h-3.5 text-obsidian-400" />
        ) : (
          <Sparkles className="w-3.5 h-3.5 text-genki-400" />
        )}
      </div>

      <div className="flex flex-col gap-1">
        <div
          className={`
            px-4 py-3 rounded-2xl text-sm font-body leading-relaxed
            ${role === 'user'
              ? 'bg-genki-600 text-white rounded-br-md'
              : 'bg-obsidian-800 text-obsidian-100 rounded-bl-md'
            }
          `}
        >
          {text}
        </div>

        {audioUrl && (
          <button
            onClick={() => window.open(audioUrl, '_blank')}
            className="text-[10px] font-mono text-genki-500 hover:text-genki-300 ml-1 transition-colors"
          >
            ↓ Download audio
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Processing Anticipation ─────────────────────────────────────────────────

function ProcessingAnticipation() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.anticipation-item', {
        opacity: 0,
        y: 8,
        duration: 0.4,
        stagger: 0.12,
        ease: 'power2.out',
      })
    }, containerRef)
    return () => ctx.revert()
  }, [])

  return (
    <div ref={containerRef} className="flex flex-col gap-2 py-3">
      <div className="anticipation-item flex items-center gap-2 text-xs text-coral-400">
        <div className="w-1.5 h-1.5 rounded-full bg-coral-400 animate-pulse" />
        <span className="font-mono">Transcribing...</span>
      </div>
      <div className="anticipation-item flex items-center gap-2 text-xs text-obsidian-500">
        <Zap className="w-3 h-3" />
        <span className="font-mono">Maya is thinking</span>
        <TypingIndicator />
      </div>
      <div className="anticipation-item flex items-center gap-2 text-xs text-genki-400/60">
        <Mic className="w-3 h-3" />
        <span className="font-mono">Preparing response...</span>
      </div>
    </div>
  )
}

// ─── Main VoicePractice ───────────────────────────────────────────────────────

export function VoicePractice() {
  const { vadState, startListening, interrupt } = useVoice()
  const { userTranscript, mayaTranscript, isMayaSpeaking, messages, error } = useVoiceStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const [prevMsgCount, setPrevMsgCount] = useState(0)

  const isListening = vadState === 'listening'
  const isProcessing = vadState === 'processing'
  const isSpeaking = vadState === 'speaking'
  const isIdle = vadState === 'idle'

  // Entrance animation
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.vp-section', {
        opacity: 0,
        y: 20,
        duration: 0.6,
        stagger: 0.1,
        ease: 'power3.out',
      })
    }, containerRef)
    return () => ctx.revert()
  }, [])

  // Scroll to bottom when new messages
  useEffect(() => {
    if (messages.length > prevMsgCount && transcriptRef.current) {
      gsap.to(transcriptRef.current, {
        scrollTop: transcriptRef.current.scrollHeight,
        duration: 0.3,
        ease: 'power2.out',
      })
      setPrevMsgCount(messages.length)
    }
  }, [messages.length, prevMsgCount])

  const handleMicClick = useCallback(() => {
    if (isListening || isProcessing) {
      gsap.to('.mic-btn', {
        scale: 0.9,
        duration: 0.1,
        yoyo: true,
        repeat: 1,
        ease: 'power2.inOut',
        onComplete: () => interrupt(),
      })
    } else {
      gsap.to('.mic-btn', {
        scale: 0.95,
        duration: 0.08,
        yoyo: true,
        repeat: 1,
        ease: 'power2.inOut',
        onComplete: () => startListening(),
      })
    }
  }, [isListening, isProcessing, startListening, interrupt])

  const handleInterrupt = useCallback(() => {
    gsap.to('.interrupt-btn', {
      scale: 0.92,
      duration: 0.1,
      yoyo: true,
      repeat: 1,
      ease: 'power2.inOut',
      onComplete: () => interrupt(),
    })
  }, [interrupt])

  return (
    <div ref={containerRef} className="flex flex-col gap-10 pb-24">

      {/* Hero */}
      <div className="vp-section text-center pt-4">
        <h2 className="font-display text-5xl font-light text-obsidian-50 tracking-tight mb-2">
          Voice Practice
        </h2>
        <p className="text-obsidian-500 text-sm font-body">
          Speak naturally. Learn effortlessly.
        </p>
      </div>

      {/* Mic Control */}
      <div className="vp-section flex flex-col items-center gap-5">

        {/* Button */}
        <div className="relative">
          <AudioRing active={isListening || isSpeaking} />

          <div
            className={`
              mic-btn relative w-32 h-32 rounded-full flex items-center justify-center
              cursor-pointer select-none transition-all duration-300
              ${isListening ? 'bg-genki-500/20' : isProcessing ? 'bg-coral-500/20' : isSpeaking ? 'bg-genki-400/20' : 'bg-obsidian-800'}
              ${isListening ? 'genki-glow' : ''}
              ${isIdle ? 'hover:bg-obsidian-700' : ''}
              active:scale-95
            `}
            onClick={handleMicClick}
            role="button"
            tabIndex={0}
            aria-label={isListening || isProcessing ? 'Stop' : 'Start voice practice'}
          >
            {/* Icon */}
            {(isListening || isProcessing) ? (
              <MicOff className="w-12 h-12 text-coral-400 z-10" />
            ) : (
              <Mic className="w-12 h-12 text-obsidian-300 z-10" />
            )}
          </div>

          <SystemHealth />

          {/* State label */}
          <div className="mt-4 flex flex-col items-center gap-1.5">
            <span
              className={`
                inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest px-4 py-1.5 rounded-full transition-all duration-300
                ${isListening ? 'bg-genki-500/15 text-genki-300 ring-1 ring-genki-500/30' : ''}
                ${isProcessing ? 'bg-coral-500/15 text-coral-400 ring-1 ring-coral-500/30' : ''}
                ${isSpeaking ? 'bg-genki-400/15 text-genki-200 ring-1 ring-genki-400/30 animate-pulse' : ''}
                ${isIdle ? 'bg-obsidian-800 text-obsidian-500' : ''}
              `}
            >
              {isListening && <span className="w-1.5 h-1.5 rounded-full bg-genki-400 animate-pulse" />}
              {isProcessing && <span className="w-1.5 h-1.5 rounded-full bg-coral-400 animate-ping" />}
              {isSpeaking && <Zap className="w-3 h-3" />}
              {isIdle && <span className="w-1.5 h-1.5 rounded-full bg-obsidian-600" />}
              {vadState.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Waveform */}
        <Waveform mode={isIdle ? 'idle' : isListening ? 'listening' : isProcessing ? 'processing' : 'speaking'} />

        {/* Interrupt */}
        {(isListening || isProcessing || isSpeaking) && (
          <button
            onClick={handleInterrupt}
            className="interrupt-btn genki-btn-ghost flex items-center gap-2 text-coral-400 border-coral-500/30 hover:bg-coral-500/10 px-4 py-2 rounded-xl transition-all"
          >
            <Square className="w-3.5 h-3.5" />
            <span className="text-xs font-mono uppercase tracking-widest">Interrupt</span>
          </button>
        )}
      </div>

      {/* Transcript */}
      <div className="vp-section genki-glass rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-obsidian-700/50">
          <h3 className="text-[11px] font-mono text-obsidian-500 uppercase tracking-widest">
            Live Transcript
          </h3>
          {userTranscript && (
            <span className="text-[10px] font-mono text-obsidian-600">
              {userTranscript.length} chars
            </span>
          )}
        </div>

        <div ref={transcriptRef} className="p-5 space-y-4 min-h-[140px] max-h-[280px] overflow-y-auto">

          {isProcessing && !userTranscript && !mayaTranscript && (
            <ProcessingAnticipation />
          )}

          {userTranscript && (
            <MessageBubble role="user" text={userTranscript} isNew />
          )}

          {mayaTranscript && (
            <MessageBubble role="maya" text={mayaTranscript} isNew />
          )}

          {!userTranscript && !mayaTranscript && !isProcessing && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-obsidian-800/60 flex items-center justify-center mb-3">
                <Mic className="w-5 h-5 text-obsidian-600" />
              </div>
              <p className="text-sm text-obsidian-600 italic font-body">
                Tap the mic to begin...
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-coral-500/10 border border-coral-500/20">
              <p className="text-xs font-mono text-coral-400">{error}</p>
            </div>
          )}
        </div>

        {/* Scroll hint */}
        {messages.length > 3 && (
          <div className="flex justify-center pb-2">
            <ChevronDown className="w-4 h-4 text-obsidian-600 animate-bounce" />
          </div>
        )}
      </div>

      {/* Message History */}
      {messages.length > 0 && (
        <div className="vp-section space-y-3">
          <h3 className="text-[11px] font-mono text-obsidian-600 uppercase tracking-widest">
            Session ({messages.length})
          </h3>

          <div className="flex flex-col gap-3">
            {messages.map((msg, idx) => (
              <MessageBubble
                key={msg.id}
                role={msg.role}
                text={msg.text}
                audioUrl={msg.audioUrl}
                isNew={idx === messages.length - 1}
              />
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
