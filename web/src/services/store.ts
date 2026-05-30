import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { VadState, ConversationMessage } from '@/types/voice'

interface VoiceState {
  sessionId: string | null
  vadState: VadState
  userTranscript: string
  mayaTranscript: string
  isMayaSpeaking: boolean
  error: string | null
  audioDownloadUrl: string | null
  messages: ConversationMessage[]
}

interface VoiceActions {
  setSessionId: (id: string) => void
  setVadState: (state: VadState) => void
  setUserTranscript: (text: string) => void
  setMayaTranscript: (text: string) => void
  setMayaSpeaking: (speaking: boolean) => void
  setError: (error: string | null) => void
  setAudioDownloadUrl: (url: string | null) => void
  addMessage: (msg: Omit<ConversationMessage, 'id' | 'timestamp'>) => void
  updateLastMessageAudio: (audioUrl: string) => void
  resetSession: () => void
}

export const useVoiceStore = create<VoiceState & VoiceActions>((set, get) => ({
  sessionId: null,
  vadState: 'idle',
  userTranscript: '',
  mayaTranscript: '',
  isMayaSpeaking: false,
  error: null,
  audioDownloadUrl: null,
  messages: [],

  setSessionId: (id) => set({ sessionId: id }),
  setVadState: (vadState) => set({ vadState }),
  setUserTranscript: (userTranscript) => set({ userTranscript }),
  setMayaTranscript: (mayaTranscript) => set({ mayaTranscript }),
  setMayaSpeaking: (isMayaSpeaking) => set({ isMayaSpeaking }),
  setError: (error) => set({ error }),
  setAudioDownloadUrl: (audioDownloadUrl) => set({ audioDownloadUrl }),

  addMessage: (msg) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...msg,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
        },
      ],
    })),

  updateLastMessageAudio: (audioUrl) =>
    set((state) => {
      const msgs = [...state.messages]
      const lastMayaIdx = msgs.findLastIndex((m) => m.role === 'maya')
      if (lastMayaIdx !== -1) {
        msgs[lastMayaIdx] = { ...msgs[lastMayaIdx], audioUrl }
      }
      return { messages: msgs, audioDownloadUrl: audioUrl }
    }),

  resetSession: () =>
    set({
      vadState: 'idle',
      userTranscript: '',
      mayaTranscript: '',
      isMayaSpeaking: false,
      error: null,
      audioDownloadUrl: null,
      messages: [],
    }),
}))

interface UserSettings {
  ttsProvider: 'kokoro' | 'f5tts' | 'vibevoice7b'
  voiceId: string
  speed: number
}

interface SettingsState {
  settings: UserSettings
  updateSettings: (s: Partial<UserSettings>) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: {
        ttsProvider: 'kokoro',
        voiceId: 'af_bella',
        speed: 1.0,
      },
      updateSettings: (partial) =>
        set((state) => ({ settings: { ...state.settings, ...partial } })),
    }),
    { name: 'genki-settings' }
  )
)
