import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SettingsModal, SettingsModalProvider, useSettingsModal } from './settings-modal';

const refresh = vi.fn();

vi.mock('@/hooks/use-settings', () => ({
  useSettings: () => ({ refresh }),
}));

function OpenSettings() {
  const { open } = useSettingsModal();
  return <button onClick={open}>Open settings</button>;
}

function renderModal() {
  render(
    <SettingsModalProvider>
      <OpenSettings />
      <SettingsModal />
    </SettingsModalProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
}

function settingsResponse(overrides = {}) {
  return {
    ok: true,
    json: async () => ({
      ttsProvider: 'f5tts',
      kokoroVoice: 'af_bella',
      f5ttsVoice: 'en-Emma_woman',
      playbackSpeed: 1,
      ...overrides,
    }),
  };
}

describe('SettingsModal voice tests', () => {
  const fetchMock = vi.fn();
  const alertMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('alert', alertMock);
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:test') });
    fetchMock.mockReset();
    alertMock.mockReset();
    refresh.mockReset();
    fetchMock.mockResolvedValue(settingsResponse());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function openModal() {
    renderModal();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/settings'));
    await act(async () => {
      await Promise.resolve();
    });
  }

  it('starts with every F5-TTS Test button enabled', async () => {
    await openModal();

    expect(screen.getAllByRole('button', { name: 'Test' }).every((button) => !button.hasAttribute('disabled'))).toBe(true);
  });

  it('disables every Test button while one voice test is pending', async () => {
    let resolveTest!: (response: { ok: boolean; blob: () => Promise<Blob> }) => void;
    const pendingTest = new Promise<{ ok: boolean; blob: () => Promise<Blob> }>((resolve) => {
      resolveTest = resolve;
    });
    fetchMock.mockResolvedValueOnce(settingsResponse()).mockReturnValueOnce(pendingTest);
    await openModal();

    fireEvent.click(screen.getAllByRole('button', { name: 'Test' })[0]);

    expect(screen.getAllByRole('button', { name: 'Test' }).every((button) => button.hasAttribute('disabled'))).toBe(true);

    await act(async () => {
      resolveTest({ ok: true, blob: async () => new Blob(['audio']) });
    });
  });

  it('re-enables Test buttons after a successful voice test', async () => {
    fetchMock.mockResolvedValueOnce(settingsResponse({ f5ttsBaseUrl: 'http://f5.test' })).mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(['audio']),
    });
    await openModal();

    fireEvent.click(screen.getAllByRole('button', { name: 'Test' })[0]);

    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('http://f5.test/tts', expect.any(Object)));
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Test' }).every((button) => !button.hasAttribute('disabled'))).toBe(true);
    });
  });

  it('re-enables Test buttons after a rejected voice test', async () => {
    fetchMock.mockResolvedValueOnce(settingsResponse()).mockRejectedValueOnce(new Error('unavailable'));
    await openModal();

    fireEvent.click(screen.getAllByRole('button', { name: 'Test' })[0]);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Test' }).every((button) => !button.hasAttribute('disabled'))).toBe(true);
    });
  });

  it('keeps Test buttons disabled after 10 seconds and re-enables them after 20 seconds', async () => {
    fetchMock.mockResolvedValueOnce(settingsResponse()).mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Timed out', 'AbortError')));
    }));
    await openModal();
    vi.useFakeTimers();

    fireEvent.click(screen.getAllByRole('button', { name: 'Test' })[0]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(screen.getAllByRole('button', { name: 'Test' }).every((button) => button.hasAttribute('disabled'))).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(screen.getAllByRole('button', { name: 'Test' }).every((button) => !button.hasAttribute('disabled'))).toBe(true);
  });
});
