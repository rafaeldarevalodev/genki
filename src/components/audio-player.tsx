'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { Play, Pause, Download, Loader2 } from 'lucide-react';
import WaveSurfer from 'wavesurfer.js';

interface AudioPlayerProps {
  audioUrl: string;
  onClose?: () => void;
}

export default function AudioPlayer({ audioUrl, onClose }: AudioPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!containerRef.current || !audioUrl) return;

    let isMounted = true;
    setIsLoading(true);

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#c7d2fe',
      progressColor: '#4f46e5',
      cursorColor: '#4f46e5',
      barWidth: 2,
      barRadius: 2,
      height: 50,
      normalize: true,
    });

    ws.load(audioUrl);

    ws.on('ready', () => {
      if (!isMounted) return;
      setIsLoading(false);
      setDuration(ws.getDuration());
    });

    ws.on('timeupdate', () => {
      if (!isMounted) return;
      setCurrentTime(ws.getCurrentTime());
    });

    ws.on('seeking', () => {
      if (!isMounted) return;
      setCurrentTime(ws.getCurrentTime());
    });

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => {
      setIsPlaying(false);
      ws.setTime(0);
    });

    wavesurferRef.current = ws;

    return () => {
      isMounted = false;
      wavesurferRef.current = null;
    };
  }, [audioUrl]);

  const togglePlay = useCallback(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = 'genki-audio.wav';
    link.click();
  };

  return (
    <div className="bg-slate-50 rounded-2xl p-4 mt-2 border border-slate-200">
      <div ref={containerRef} className="w-full" />
      
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            disabled={isLoading}
            className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : isPlaying ? (
              <Pause size={18} />
            ) : (
              <Play size={18} className="ml-0.5" />
            )}
          </button>
          
          <div className="text-xs font-medium text-slate-500 font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors text-xs font-medium"
          >
            <Download size={14} />
            Download
          </button>
          
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
}