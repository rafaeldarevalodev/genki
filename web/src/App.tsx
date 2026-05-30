import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { Settings, User, BookOpen } from 'lucide-react'
import { VoicePractice } from '@/features/voice-practice/VoicePractice'

export function App() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Staggered entrance
      gsap.from('.app-header', {
        opacity: 0,
        y: -16,
        duration: 0.7,
        ease: 'power3.out',
      })
      gsap.from('.hero-title', {
        opacity: 0,
        y: 30,
        duration: 0.9,
        delay: 0.1,
        ease: 'power3.out',
      })
      gsap.from('.hero-sub', {
        opacity: 0,
        y: 20,
        duration: 0.7,
        delay: 0.25,
        ease: 'power3.out',
      })
      gsap.from('.mic-section', {
        opacity: 0,
        scale: 0.92,
        duration: 0.8,
        delay: 0.35,
        ease: 'back.out(1.2)',
      })
    }, rootRef)

    return () => ctx.revert()
  }, [])

  return (
    <div ref={rootRef} className="min-h-dvh bg-obsidian-950 bg-grid-pattern flex flex-col">

      {/* Header */}
      <header className="app-header sticky top-0 z-50 backdrop-blur-xl bg-obsidian-950/80 border-b border-obsidian-800/40">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">

            {/* Logo */}
            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-genki-500 to-genki-700 flex items-center justify-center shadow-lg shadow-genki-500/20 group-hover:shadow-genki-500/30 transition-shadow">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path
                      d="M9 2L11.5 7.5H16L12 11L13.8 16.5L9 13L4.2 16.5L6 11L2 7.5H6.5L9 2Z"
                      fill="white"
                      fillOpacity="0.95"
                    />
                  </svg>
                </div>
                <div className="absolute -inset-1 bg-genki-500/30 rounded-xl blur-md -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>

              <div>
                <h1 className="font-display text-xl font-semibold tracking-tight text-obsidian-50">
                  Genki
                </h1>
                <p className="text-[9px] font-mono text-obsidian-600 uppercase tracking-[0.2em]">
                  AI Tutor
                </p>
              </div>
            </div>

            {/* Nav */}
            <nav className="flex items-center gap-1">
              {[
                { icon: BookOpen, label: 'Practice', active: true },
                { icon: User, label: 'Profile', active: false },
                { icon: Settings, label: 'Settings', active: false },
              ].map(({ icon: Icon, label, active }) => (
                <button
                  key={label}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium
                    transition-all duration-200
                    ${active
                      ? 'bg-genki-500/15 text-genki-300 border border-genki-500/25'
                      : 'text-obsidian-500 hover:text-obsidian-300 hover:bg-obsidian-800'
                    }
                  `}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-8">
        <VoicePractice />
      </main>

      {/* Footer */}
      <footer className="border-t border-obsidian-800/30 py-4">
        <div className="max-w-3xl mx-auto px-6 flex items-center justify-between">
          <p className="text-[10px] font-mono text-obsidian-700">
            Genki 2.0 — Local AI Language Tutor
          </p>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-mono text-obsidian-700">System ready</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
