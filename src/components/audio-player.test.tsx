import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import AudioPlayer from './audio-player';

const mockDestroy = vi.fn();
const mockLoad = vi.fn();
const mockPlayPause = vi.fn();
const mockGetDuration = vi.fn(() => 2.5);
const mockGetCurrentTime = vi.fn(() => 0);
const mockOn = vi.fn(() => {});
const mockSetTime = vi.fn();

// Track WaveSurfer.create options across all renders
const createCalls: Array<{ fetchParams?: { signal?: AbortSignal } }> = [];

vi.mock('wavesurfer.js', () => ({
  default: {
    create: vi.fn((opts: any) => {
      createCalls.push(opts);
      return {
        load: mockLoad,
        on: mockOn,
        destroy: mockDestroy,
        playPause: mockPlayPause,
        getDuration: mockGetDuration,
        getCurrentTime: mockGetCurrentTime,
        setTime: mockSetTime,
      };
    }),
  },
}));

describe('AudioPlayer — AbortError handling', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createCalls.length = 0;
    vi.clearAllMocks();
    mockDestroy.mockImplementation(() => {});
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should pass our own AbortController signal to WaveSurfer via fetchParams', () => {
    render(<AudioPlayer audioUrl="blob:test" />);

    // fetchParams must be present and contain a valid signal
    expect(createCalls[0]).toBeDefined();
    expect(createCalls[0].fetchParams).toBeDefined();
    expect(createCalls[0].fetchParams?.signal).toBeInstanceOf(AbortSignal);
  });

  it('should call destroy() on cleanup without throwing', () => {
    const { unmount } = render(<AudioPlayer audioUrl="blob:test" />);
    act(() => { unmount(); });
    expect(mockDestroy).toHaveBeenCalled();
  });

  it('should register ws.on("error") handler that silences AbortError and real errors', () => {
    const handlers: Array<{ event: string; cb: Function }> = [];
    mockOn.mockImplementation((event: string, cb: Function) => {
      handlers.push({ event, cb });
    });

    render(<AudioPlayer audioUrl="blob:test" />);

    const errorHandler = handlers.find(h => h.event === 'error');
    expect(errorHandler).toBeDefined();

    // AbortError is silenced — should not throw
    expect(() => errorHandler!.cb(new DOMException('signal is aborted without reason', 'AbortError'))).not.toThrow();
    // Real errors are also silenced (logged via console.warn instead)
    expect(() => errorHandler!.cb(new Error('Network failure'))).not.toThrow();
  });

  it('should suppress only AbortError in ws.on("error") — real errors go to console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handlers: Array<{ event: string; cb: Function }> = [];
    mockOn.mockImplementation((event: string, cb: Function) => {
      handlers.push({ event, cb });
    });

    render(<AudioPlayer audioUrl="blob:test" />);

    const errorHandler = handlers.find(h => h.event === 'error');
    expect(errorHandler).toBeDefined();

    // AbortError → silently ignored (no console output)
    errorHandler!.cb(new DOMException('signal is aborted', 'AbortError'));
    expect(consoleSpy).not.toHaveBeenCalled();

    // Real error → logged to console.warn
    errorHandler!.cb(new Error('Failed to fetch audio'));
    expect(warnSpy).toHaveBeenCalledWith('[AudioPlayer] WaveSurfer error:', expect.any(Error));

    warnSpy.mockRestore();
  });

  it('should call destroy() on cleanup', () => {
    const { unmount } = render(<AudioPlayer audioUrl="blob:test" />);
    act(() => { unmount(); });
    expect(mockDestroy).toHaveBeenCalled();
  });
});