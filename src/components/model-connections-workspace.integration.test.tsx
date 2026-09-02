import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModelConnectionsProvider } from '@/hooks/use-settings';
import type { ModelConnection, ConnectionValidation } from '@/lib/model-connections';
import type { ModelConnectionsRepository } from '@/lib/model-connections-db';
import type { ValidationResult } from '@/lib/model-connection-validator';
import { ModelConnectionsWorkspace } from './model-connections-workspace';

// --- Mocks ---

vi.mock('@/lib/model-connection-validator', () => ({
  validateModelConnection: vi.fn(),
}));

// --- Helpers ---

function makeConnection(overrides: Partial<ModelConnection> = {}): ModelConnection {
  return {
    id: 'c1',
    name: 'My Local Server',
    baseUrl: 'http://localhost:11434',
    modelId: 'llama3',
    lifecycle: 'validated',
    validation: { status: 'connected', checkedAt: '2025-01-01T00:00:00Z' },
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function createMockRepo(connections: ModelConnection[] = [], activeConnectionId?: string): ModelConnectionsRepository {
  return {
    load: vi.fn().mockResolvedValue({ connections, activeConnectionId }),
    save: vi.fn().mockResolvedValue(undefined),
    activate: vi.fn().mockResolvedValue(undefined),
    deactivate: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

/** Radix Tabs requires mouseDown to activate, not just click. */
function clickTab(name: string | RegExp) {
  const tab = screen.getByRole('tab', { name });
  fireEvent.mouseDown(tab);
  fireEvent.mouseUp(tab);
  fireEvent.click(tab);
}

function getStatusBadges(): HTMLElement[] {
  return screen.getAllByText(/^(Connected|Auth required|Incompatible|Offline|Timeout|Blocked)$/i);
}

function queryToastByText(text: string | RegExp): HTMLElement | null {
  return screen.queryByText(text);
}

async function renderWorkspace(
  connections: ModelConnection[] = [],
  activeConnectionId?: string,
  repositoryOverrides?: Partial<ModelConnectionsRepository>,
) {
  const baseRepo = createMockRepo(connections, activeConnectionId);
  const fullRepo: ModelConnectionsRepository = {
    load: repositoryOverrides?.load ?? baseRepo.load,
    save: repositoryOverrides?.save ?? baseRepo.save,
    activate: repositoryOverrides?.activate ?? baseRepo.activate,
    deactivate: repositoryOverrides?.deactivate ?? baseRepo.deactivate,
    delete: repositoryOverrides?.delete ?? baseRepo.delete,
  };
  const result = render(
    <ModelConnectionsProvider enabled repository={fullRepo}>
      <ModelConnectionsWorkspace />
    </ModelConnectionsProvider>,
  );
  await waitFor(() => {
    if (connections.length > 0) {
      expect(screen.getAllByText(connections[0].name).length).toBeGreaterThanOrEqual(1);
    } else {
      expect(screen.getByText(/no saved connections/i)).toBeTruthy();
    }
  });
  return result;
}

// --- Tests ---

describe('ModelConnectionsWorkspace integration', () => {
  let validateMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    validateMock = (await import('@/lib/model-connection-validator')).validateModelConnection as ReturnType<typeof vi.fn>;
    validateMock.mockReset();

    // Clean up any leftover IndexedDB databases
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase('genki-model-connections');
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase('genki-model-connections');
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  });

  it('full flow: add connection, test (200), activate, verify active summary', async () => {
    validateMock.mockResolvedValue({
      status: 'connected',
      checkedAt: new Date().toISOString(),
    } satisfies ValidationResult);

    await renderWorkspace([], undefined);

    // Open the Add connection tab
    clickTab(/add connection/i);

    // Fill in the form fields
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'My Ollama' } });
    fireEvent.change(screen.getByLabelText(/url/i), { target: { value: 'http://localhost:11434' } });
    fireEvent.change(screen.getByLabelText(/credential/i), { target: { value: 'my-secret-key' } });
    fireEvent.change(screen.getByLabelText(/model id/i), { target: { value: 'llama3' } });

    // Click Test button
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    // Verify validator was called
    await waitFor(() => {
      expect(validateMock).toHaveBeenCalledTimes(1);
    });
    expect(validateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: 'http://localhost:11434',
        credential: 'my-secret-key',
      }),
    );

    // Verify status badge shows Connected
    await waitFor(() => {
      const badges = getStatusBadges();
      expect(badges.some((b) => b.textContent === 'Connected')).toBe(true);
    });

    // Click Activate button
    fireEvent.click(screen.getByRole('button', { name: /activate/i }));

    // Verify active model summary shows
    await waitFor(() => {
      expect(screen.getAllByText('My Ollama').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText(/connected/i).length).toBeGreaterThan(0);
  });

  it('discovery failure: add connection, test (404), verify incompatible status', async () => {
    validateMock.mockResolvedValue({
      status: 'incompatible',
      checkedAt: new Date().toISOString(),
      httpStatus: 404,
    } satisfies ValidationResult);

    await renderWorkspace([], undefined);

    clickTab(/add connection/i);

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Bad Endpoint' } });
    fireEvent.change(screen.getByLabelText(/url/i), { target: { value: 'http://localhost:9999' } });
    fireEvent.change(screen.getByLabelText(/model id/i), { target: { value: 'test-model' } });

    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    await waitFor(() => {
      expect(validateMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      const badges = getStatusBadges();
      expect(badges.some((b) => b.textContent === 'Incompatible')).toBe(true);
    });
  });

  it('active preservation on failure: activate connection, re-validate fails, active preserved', async () => {
    // Start with an active connection
    const conn = makeConnection({
      validation: { status: 'connected', checkedAt: '2025-01-01T00:00:00Z' },
    });

    await renderWorkspace([conn], 'c1');

    // Active model summary should be visible
    expect(screen.getAllByText('My Local Server').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/connected/i).length).toBeGreaterThan(0);

    // Now mock validation to fail
    validateMock.mockResolvedValue({
      status: 'offline',
      checkedAt: new Date().toISOString(),
    } satisfies ValidationResult);

    // Click Change to open editor for the active connection
    fireEvent.click(screen.getByRole('button', { name: /change/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/name/i)).toBeTruthy();
    });

    // Click Test in the editor
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    await waitFor(() => {
      expect(validateMock).toHaveBeenCalledTimes(1);
    });

    // Verify offline status shown
    await waitFor(() => {
      const badges = getStatusBadges();
      expect(badges.some((b) => b.textContent === 'Offline')).toBe(true);
    });

    // Verify the active connection is still shown in the summary
    expect(screen.getAllByText('My Local Server').length).toBeGreaterThanOrEqual(1);
  });

  it('draft reload: open editor, fill fields, close, reopen, verify fields restored', async () => {
    await renderWorkspace([], undefined);

    // Open editor and fill fields
    clickTab(/add connection/i);
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Draft Model' } });
    fireEvent.change(screen.getByLabelText(/url/i), { target: { value: 'http://localhost:8080' } });
    fireEvent.change(screen.getByLabelText(/credential/i), { target: { value: 'draft-secret' } });
    fireEvent.change(screen.getByLabelText(/model id/i), { target: { value: 'draft-llama' } });

    // Close editor by switching to Connections tab
    clickTab(/connections/i);
    await waitFor(() => {
      expect(screen.queryByLabelText(/name/i)).toBeNull();
    });

    // Reopen editor
    clickTab(/add connection/i);
    await waitFor(() => {
      expect(screen.getByLabelText(/name/i)).toBeTruthy();
    });

    // Verify fields are restored
    await waitFor(() => {
      expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('Draft Model');
      expect((screen.getByLabelText(/url/i) as HTMLInputElement).value).toBe('http://localhost:8080');
      expect((screen.getByLabelText(/credential/i) as HTMLInputElement).value).toBe('draft-secret');
      expect((screen.getByLabelText(/model id/i) as HTMLInputElement).value).toBe('draft-llama');
    });
  });

  it('unavailable storage: mock IndexedDB failure, verify error state shown', async () => {
    const failingRepo = createMockRepo();
    failingRepo.load.mockRejectedValue(new Error('Storage unavailable'));

    await renderWorkspace([], undefined, { load: failingRepo.load });

    await waitFor(() => {
      expect(screen.getByText(/model connection storage is unavailable/i)).toBeTruthy();
    });
  });

  it('no credentials in diagnostics: credential never appears in any text content or toast', async () => {
    const credential = 'super-secret-api-key-12345';

    validateMock.mockResolvedValue({
      status: 'connected',
      checkedAt: new Date().toISOString(),
    } satisfies ValidationResult);

    await renderWorkspace([], undefined);

    // Open editor, fill fields including credential
    clickTab(/add connection/i);
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Secure Model' } });
    fireEvent.change(screen.getByLabelText(/url/i), { target: { value: 'http://localhost:11434' } });
    fireEvent.change(screen.getByLabelText(/credential/i), { target: { value: credential } });
    fireEvent.change(screen.getByLabelText(/model id/i), { target: { value: 'llama3' } });

    // Test connection (validator is called)
    fireEvent.click(screen.getByRole('button', { name: /test/i }));
    await waitFor(() => {
      expect(validateMock).toHaveBeenCalledTimes(1);
    });

    // Activate connection
    fireEvent.click(screen.getByRole('button', { name: /activate/i }));
    await waitFor(() => {
      expect(screen.getAllByText('Secure Model').length).toBeGreaterThanOrEqual(1);
    });

    // Verify credential is NOT visible anywhere in the document
    const bodyText = document.body.textContent ?? '';
    expect(bodyText).not.toContain(credential);

    // Check that no visible text element contains the credential
    const allTextElements = document.body.querySelectorAll('*');
    for (const el of allTextElements) {
      // Only check leaf text nodes (not input values which intentionally hold the credential)
      if (el.children.length === 0 && el.textContent) {
        expect(el.textContent).not.toContain(credential);
      }
    }

    // Verify no toast shows the credential
    expect(queryToastByText(new RegExp(credential))).toBeNull();
  });
});
