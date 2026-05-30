import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { VoicePractice } from '@/features/voice-practice/VoicePractice'

export function App() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.app-header', {
        opacity: 0,
        y: -20,
        duration: 0.8,
        ease: 'power3.out',
      })
      gsap.from('.app-main', {
        opacity: 0,
        y: 24,
        duration: 0.9,
        delay: 0.15,
        ease: 'power3.out',
      })
    }, rootRef)

    return () => ctx.revert()
  }, [])

  return (
    <div ref={rootRef} className="min-h-dvh bg-obsidian-950 bg-grid-pattern flex flex-col">
      <header className="app-header border-b border-obsidian-800/60 backdrop-blur-sm bg-obsidian-950/80 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-8 h-8 rounded-xl bg-genki-500/20 border border-genki-500/40 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2L10.5 7H14L11 10.5L12.5 15L8 12L3.5 15L5 10.5L2 7H5.5L8 2Z" fill="#0ea5e9" />
                </svg>
              </div>
              <div className="absolute -inset-1 bg-genki-500/20 rounded-xl blur-md -z-10" />
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold tracking-tight text-obsidian-50">
                Genki
              </h1>
              <p className="text-[10px] font-mono text-obsidian-500 uppercase tracking-widest">
                AI Language Tutor
              </p>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            <button className="genki-btn-ghost text-xs px-3 py-1.5">
              Practice
            </button>
            <button className="genki-btn-ghost text-xs px-3 py-1.5">
              Decks
            </button>
            <button className="genki-btn-ghost text-xs px-3 py-1.5">
              Profile
            </button>
          </nav>
        </div>
      </header>

      <main className="app-main flex-1 max-w-3xl mx-auto w-full px-6 py-8">
        <VoicePractice />
      </main>
    </div>
  )
}
