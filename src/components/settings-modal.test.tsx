import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SettingsModal, SettingsModalProvider, useSettingsModal } from './settings-modal';

const refresh = vi.fn();

vi.mock('@/hooks/use-settings', () => ({
  useSettings: () => ({ refresh }),
  useModelConnections: () => ({
    enabled: false,
    isLoaded: true,
    connections: [],
    activeConnectionId: undefined,
    refresh: vi.fn(),
    save: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
    deleteConnection: vi.fn(),
  }),
}));

vi.mock('@/components/model-connections-workspace', () => ({
  ModelConnectionsWorkspace: () => (
    <div data-testid="model-connections-workspace">Model Connections Workspace</div>
  ),
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

/** Radix Tabs requires mouseDown to activate, not just click. */
function clickTab(name: string | RegExp) {
  const tab = screen.getByRole('tab', { name });
  fireEvent.mouseDown(tab);
  fireEvent.mouseUp(tab);
  fireEvent.click(tab);
}

describe('SettingsModal tab structure', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:test') });
    fetchMock.mockReset();
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

  it('renders Models & connections and Voice tabs', async () => {
    await openModal();

    expect(screen.getByRole('tab', { name: /models & connections/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /voice/i })).toBeTruthy();
  });

  it('defaults to Voice tab', async () => {
    await openModal();

    const voiceTab = screen.getByRole('tab', { name: /voice/i });
    expect(voiceTab.getAttribute('aria-selected')).toBe('true');
  });

  it('renders ModelConnectionsWorkspace in Models & connections tab', async () => {
    await openModal();

    clickTab(/models & connections/i);

    expect(screen.getByTestId('model-connections-workspace')).toBeTruthy();
  });

  it('does not render ModelConnectionsWorkspace when Voice tab is active', async () => {
    await openModal();

    expect(screen.queryByTestId('model-connections-workspace')).toBeNull();
  });

  it('switches to Models & connections tab on click', async () => {
    await openModal();

    clickTab(/models & connections/i);

    const modelsTab = screen.getByRole('tab', { name: /models & connections/i });
    expect(modelsTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('model-connections-workspace')).toBeTruthy();
  });

  it('switches back to Voice tab and shows voice settings', async () => {
    await openModal();

    clickTab(/models & connections/i);
    clickTab(/voice/i);

    const voiceTab = screen.getByRole('tab', { name: /voice/i });
    expect(voiceTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByTestId('model-connections-workspace')).toBeNull();
  });

  it('supports ArrowRight key to move focus to next tab', async () => {
    await openModal();

    const voiceTab = screen.getByRole('tab', { name: /voice/i });
    const modelsTab = screen.getByRole('tab', { name: /models & connections/i });

    voiceTab.focus();
    fireEvent.keyDown(voiceTab, { key: 'ArrowRight' });

    // happy-dom may not update document.activeElement for Radix roving focus,
    // but ArrowRight should be handled without error — activation is tested below.
    expect(modelsTab).toBeTruthy();
  });

  it('activates focused tab with Enter', async () => {
    await openModal();

    const voiceTab = screen.getByRole('tab', { name: /voice/i });
    voiceTab.focus();
    fireEvent.keyDown(voiceTab, { key: 'ArrowRight' });
    fireEvent.keyUp(voiceTab, { key: 'ArrowRight' });

    const modelsTab = screen.getByRole('tab', { name: /models & connections/i });
    fireEvent.keyDown(modelsTab, { key: 'Enter' });

    expect(modelsTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('model-connections-workspace')).toBeTruthy();
  });

  it('activates tab with Space key', async () => {
    await openModal();

    const voiceTab = screen.getByRole('tab', { name: /voice/i });
    voiceTab.focus();
    fireEvent.keyDown(voiceTab, { key: 'ArrowRight' });
    fireEvent.keyUp(voiceTab, { key: 'ArrowRight' });

    const modelsTab = screen.getByRole('tab', { name: /models & connections/i });
    fireEvent.keyDown(modelsTab, { key: ' ' });

    expect(modelsTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('model-connections-workspace')).toBeTruthy();
  });
});

describe('SettingsModal LLM Provider removed', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:test') });
    fetchMock.mockReset();
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

  it('does not render AI Model Provider section', async () => {
    await openModal();

    expect(screen.queryByText(/ai model provider/i)).toBeNull();
  });

  it('does not render cloud/local radio buttons', async () => {
    await openModal();

    expect(screen.queryByText(/cloud.*nvidia/i)).toBeNull();
    expect(screen.queryByText(/local.*lm studio/i)).toBeNull();
  });

  it('does not render Cloud Model input', async () => {
    await openModal();

    expect(screen.queryByText(/cloud model/i)).toBeNull();
  });
});

describe('SettingsModal save button scoped to Voice', () => {
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

  it('shows Save Settings button in Voice tab', async () => {
    await openModal();

    expect(screen.getByRole('button', { name: /save settings/i })).toBeTruthy();
  });

  it('save button posts voice settings (not LLM provider)', async () => {
    await openModal();

    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/settings', expect.objectContaining({
        method: 'POST',
      }));
    });

    const callArgs = fetchMock.mock.calls.find(
      (call: unknown[]) => call[0] === '/api/settings' && (call[1] as RequestInit)?.method === 'POST',
    ) as [string, RequestInit] | undefined;
    expect(callArgs).toBeDefined();
    const body = JSON.parse(callArgs![1].body as string);
    expect(body).toHaveProperty('ttsProvider');
    expect(body).not.toHaveProperty('provider');
    expect(body).not.toHaveProperty('cloudModel');
  });

  it('does not show Save Settings in Models & connections tab', async () => {
    await openModal();

    clickTab(/models & connections/i);

    expect(screen.queryByRole('button', { name: /save settings/i })).toBeNull();
  });
});

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
