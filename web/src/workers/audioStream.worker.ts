/**
 * Audio Stream Worker
 * Handles decompression and PCM playback off the main thread.
 * Mirrors the original audio-stream.worker.ts from the Genki MVP.
 */
import pako from 'pako'

const ctx: Worker = self as unknown as Worker

let audioContext: AudioContext | null = null
let nextStartTime = 0
let abortPlayback = false
let audioChunks: string[] = []

function initAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext()
  }
}

async function decompressGzip(base64Compressed: string): Promise<string> {
  const binaryString = atob(base64Compressed)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  const decompressed = pako.ungzip(bytes, { to: 'uint8array' })
  let result = ''
  for (let i = 0; i < decompressed.length; i++) {
    result += String.fromCharCode(decompressed[i])
  }
  return btoa(result)
}

function base64ToFloat32(b64: string): Float32Array {
  const binaryString = atob(b64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  const int16Array = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.length / 2)
  const float32Array = new Float32Array(int16Array.length)
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / 32768
  }
  return float32Array
}

function scheduleChunk(pcmData: Float32Array, sampleRate: number) {
  if (!audioContext) return
  const buffer = audioContext.createBuffer(1, pcmData.length, sampleRate)
  buffer.getChannelData(0).set(pcmData)
  const source = audioContext.createBufferSource()
  source.buffer = buffer
  source.connect(audioContext.destination)
  if (!nextStartTime) {
    nextStartTime = audioContext.currentTime + 0.1
  }
  source.start(nextStartTime)
  nextStartTime += buffer.duration
  isPlaying = true
}

ctx.addEventListener('message', async (event) => {
  const { type, data } = event.data

  switch (type) {
    case 'init':
      initAudioContext()
      break

    case 'chunk': {
      if (abortPlayback) return

      let { data: b64Data, sample_rate = 24000, compressed = false, chunk_index, total_chunks } = data

      if (total_chunks !== undefined && total_chunks > 1) {
        audioChunks[chunk_index] = b64Data
        if (audioChunks.filter((c) => c !== undefined).length === total_chunks) {
          const fullData = audioChunks.join('')
          audioChunks = []
          const processed = compressed ? await decompressGzip(fullData) : fullData
          const pcmData = base64ToFloat32(processed)
          scheduleChunk(pcmData, sample_rate)
        }
        return
      }

      if (compressed) {
        b64Data = await decompressGzip(b64Data)
      }
      const pcmData = base64ToFloat32(b64Data)
      scheduleChunk(pcmData, sample_rate)
      break
    }

    case 'abort':
      abortPlayback = true
      if (audioContext) {
        audioContext.suspend()
        audioContext.close()
        audioContext = null
      }
      nextStartTime = 0
      ctx.postMessage({ type: 'aborted' })
      break

    case 'resume':
      abortPlayback = false
      initAudioContext()
      break

    case 'reset':
      abortPlayback = false
      nextStartTime = 0
      audioChunks = []
      if (audioContext) {
        audioContext.close()
        audioContext = null
      }
      break
  }
})

let isPlaying = false

export {}
