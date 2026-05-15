// Audio Stream Worker for Maya Live Voice
// Decodes audio in worker, sends samples to main thread for playback

// Load pako from CDN for gzip decompression
importScripts('https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js');

console.log('[Worker] Audio stream worker loaded, pako available:', typeof pako !== 'undefined');

let abortPlayback = false;

function base64ToFloat32(b64) {
  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  const int16Array = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.length / 2);
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / 32768;
  }
  return float32Array;
}

self.onmessage = async function(event) {
  const { type, data } = event.data;
  
  console.log('[Worker] Received message:', type, data ? 'data present' : 'no data');
  
  switch (type) {
    case 'abort':
      abortPlayback = true;
      self.postMessage({ type: 'aborted' });
      break;
    
    case 'chunk': {
      abortPlayback = false;
      
      let { data: b64Data, sample_rate = 24000, compressed = false } = data;
      
      console.log('[Worker] Chunk:', { compressed, dataLength: b64Data ? b64Data.length : 0 });
      
      if (abortPlayback) break;
      
      try {
        let pcmData;
        
        if (compressed) {
          if (typeof pako === 'undefined') {
            console.error('[Worker] ERROR: pako not loaded!');
            self.postMessage({ type: 'error', message: 'pako not loaded' });
            return;
          }
          
          console.log('[Worker] Decompressing...');
          const decompressed = pako.ungzip(b64Data, { to: 'uint8array' });
          console.log('[Worker] Decompressed size:', decompressed.length, 'bytes');
          
          let b64 = '';
          for (let i = 0; i < decompressed.length; i++) {
            b64 += String.fromCharCode(decompressed[i]);
          }
          b64 = btoa(b64);
          
          pcmData = base64ToFloat32(b64);
        } else {
          console.log('[Worker] Processing uncompressed audio');
          pcmData = base64ToFloat32(b64Data);
        }
        
        console.log('[Worker] PCM samples:', pcmData.length, 'at', sample_rate, 'Hz');
        
        if (abortPlayback) break;
        
        // Send samples back to main thread for playback
        self.postMessage({
          type: 'samples',
          samples: Array.from(pcmData),
          sampleRate: sample_rate
        });
        
      } catch (err) {
        console.error('[Worker] Processing error:', err);
        self.postMessage({ type: 'error', message: err.message });
      }
      break;
    }
  }
};
