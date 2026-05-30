import { useCallback, useEffect, useRef } from 'react'
import gsap from 'gsap'
import { Mic, MicOff, Square, Zap } from 'lucide-react'
import { useVoice } from '@/hooks/useVoice'
import { useVoiceStore } from '@/services/store'

export function VoicePractice() {
  const { vadState, startListening, interrupt } = useVoice()
  const { userTranscript, mayaTranscript, isMayaSpeaking, messages, error } = useVoiceStore()
  const containerRef = useRef<HTMLDivElement>(null)

  const isListening = vadState === 'listening'
  const isProcessing = vadState === 'processing'
  const isSpeaking = vadState === 'speaking'

  // Animate waveform when listening
  useEffect(() => {
    if (!containerRef.current) return
    const ctx = gsap.context(() => {
      if (isListening) {
        gsap.to('.wave-bar', {
          scaleY: () => Math.random() * 0.8 + 0.2,
          duration: 0.15,
          ease: 'power1.inOut',
          stagger: { each: 0.05, from: 'random' },
          repeat: -1,
          yoyo: true,
        })
      } else {
        gsap.killTweensOf('.wave-bar')
        gsap.to('.wave-bar', { scaleY: 0.1, duration: 0.3 })
      }
    }, containerRef)
    return () => ctx.revert()
  }, [isListening])

  // Animate messages entrance
  useEffect(() => {
    if (messages.length === 0) return
    gsap.from('.msg-entry', {
      opacity: 0,
      x: -16,
      duration: 0.35,
      ease: 'power2.out',
      stagger: 0.07,
    })
  }, [messages.length])

  const handleMicClick = useCallback(() => {
    if (isListening || isProcessing) {
      interrupt()
    } else {
      startListening()
    }
  }, [isListening, isProcessing, startListening, interrupt])

  return (
    <div ref={containerRef} className="flex flex-col gap-8">
      {/* Hero Section */}
      <div className="text-center py-6">
        <h2 className="font-display text-4xl font-light text-obsidian-100 mb-2">
          Voice Practice
        </h2>
        <p className="text-obsidian-500 text-sm font-body">
          Converse naturally with Maya — your AI tutor.
        </p>
      </div>

      {/* Mic Control */}
      <div className="flex flex-col items-center gap-6">
        {/* Visualizer */}
        <div className="relative">
          <div
            className={`
              w-28 h-28 rounded-full flex items-center justify-center
              transition-all duration-500 cursor-pointer
              ${isListening ? 'bg-genki-500/20 genki-glow' : 'bg-obsidian-800'}
              ${isProcessing ? 'bg-coral-500/20' : ''}
              ${isSpeaking ? 'bg-genki-400/30 animate-pulse-ring' : ''}
              border-2
              ${isListening ? 'border-genki-400' : 'border-obsidian-700'}
              hover:border-genki-500/60 active:scale-95
            `}
            onClick={handleMicClick}
            role="button"
            tabIndex={0}
            aria-label={isListening || isProcessing ? 'Stop recording' : 'Start voice practice'}
          >
            <div className="flex items-end gap-1 h-10 px-8">
              {[...Array(7)].map((_, i) => (
                <div
                  key={i}
                  className="wave-bar w-1.5 bg-genki-400 rounded-full origin-bottom"
                  style={{ height: '20%' }}
                />
              ))}
            </div>

            {!isListening && !isProcessing && (
              <Mic className="absolute w-10 h-10 text-obsidian-400" />
            )}
            {(isListening || isProcessing) && (
              <MicOff className="absolute w-10 h-10 text-coral-400" />
            )}
          </div>

          {/* Status ring */}
          <div
            className={`
              absolute -inset-2 rounded-full border-2 transition-all duration-300
              ${isListening ? 'border-genki-500/40 animate-spin' : 'border-transparent'}
              ${isProcessing ? 'border-coral-500/30' : ''}
            `}
            style={{ animationDuration: '3s' }}
          />

          {/* State label */}
          <div className="mt-4 text-center">
            <span
              className={`
                inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest px-3 py-1 rounded-full
                ${isListening ? 'bg-genki-500/15 text-genki-300' : ''}
                ${isProcessing ? 'bg-coral-500/15 text-coral-400' : ''}
                ${isSpeaking ? 'bg-genki-400/15 text-genki-200' : ''}
                ${vadState === 'idle' ? 'bg-obsidian-800 text-obsidian-500' : ''}
              `}
            >
              {isListening && <span className="w-1.5 h-1.5 rounded-full bg-genki-400 animate-pulse" />}
              {isProcessing && <Zap className="w-3 h-3" />}
              {vadState === 'idle' && <span className="w-1.5 h-1.5 rounded-full bg-obsidian-600" />}
              {vadState.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Interrupt button */}
        {(isListening || isProcessing || isSpeaking) && (
          <button
            onClick={interrupt}
            className="genki-btn-ghost flex items-center gap-2 text-coral-400 border-coral-500/30 hover:bg-coral-500/10"
          >
            <Square className="w-3.5 h-3.5" />
            Interrupt
          </button>
        )}
      </div>

      {/* Transcript Display */}
      <div className="genki-glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono text-obsidian-500 uppercase tracking-widest">
            Live Transcript
          </h3>
          {userTranscript && (
            <span className="text-[10px] font-mono text-obsidian-600">
              {userTranscript.length} chars
            </span>
          )}
        </div>

        <div className="space-y-3">
          {userTranscript && (
            <div className="msg-entry flex items-start gap-3">
              <div className="w-6 h-6 rounded-lg bg-obsidian-700 flex items-center justify-center shrink-0 mt-0.5">
                <Mic className="w-3 h-3 text-obsidian-400" />
              </div>
              <p className="text-sm text-obsidian-200 font-body leading-relaxed">
                {userTranscript}
              </p>
            </div>
          )}

          {mayaTranscript && (
            <div className="msg-entry flex items-start gap-3">
              <div className="w-6 h-6 rounded-lg bg-genki-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <Zap className="w-3 h-3 text-genki-400" />
              </div>
              <p className="text-sm text-obsidian-100 font-body leading-relaxed">
                {mayaTranscript}
              </p>
            </div>
          )}

          {!userTranscript && !mayaTranscript && (
            <p className="text-sm text-obsidian-600 text-center py-4 italic">
              Start speaking to begin your session...
            </p>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-coral-500/10 border border-coral-500/20">
            <p className="text-xs font-mono text-coral-400">{error}</p>
          </div>
        )}
      </div>

      {/* Message History */}
      {messages.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-mono text-obsidian-600 uppercase tracking-widest">
            Session History
          </h3>
          {messages.map((msg) => (
            <div key={msg.id} className="msg-entry flex items-start gap-3">
              <div
                className={`
                  w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5
                  ${msg.role === 'user' ? 'bg-obsidian-700' : 'bg-genki-500/15'}
                `}
              >
                {msg.role === 'user' ? (
                  <Mic className="w-3 h-3 text-obsidian-400" />
                ) : (
                  <Zap className="w-3 h-3 text-genki-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-obsidian-200 font-body leading-relaxed">
                  {msg.text}
                </p>
                {msg.audioUrl && (
                  <a
                    href={msg.audioUrl}
                    download
                    className="text-[10px] font-mono text-genki-500 hover:text-genki-300 mt-1 inline-block"
                  >
                    ↓ Download audio
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
