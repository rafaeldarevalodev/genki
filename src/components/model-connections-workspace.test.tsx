import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModelConnectionsProvider } from '@/hooks/use-settings';
import type { ModelConnection } from '@/lib/model-connections';
import { ModelConnectionsWorkspace } from './model-connections-workspace';

// --- helpers ---

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

function createMockRepo(connections: ModelConnection[], activeConnectionId?: string) {
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

async function renderWorkspace(
  connections: ModelConnection[] = [],
  activeConnectionId?: string,
) {
  const result = render(
    <ModelConnectionsProvider enabled repository={createMockRepo(connections, activeConnectionId)}>
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

// --- tests ---

describe('ModelConnectionsWorkspace', () => {
  describe('empty state', () => {
    it('renders empty state when no connections exist', async () => {
      await renderWorkspace([], undefined);

      expect(screen.getByText(/no active model/i)).toBeTruthy();
      expect(screen.getByText(/no saved connections/i)).toBeTruthy();
    });

    it('renders Add connection button in empty state', async () => {
      await renderWorkspace([], undefined);

      expect(screen.getByRole('button', { name: /add connection/i })).toBeTruthy();
    });
  });

  describe('active model summary card', () => {
    it('shows the active connection name and route disclosure', async () => {
      const conn = makeConnection({ name: 'Ollama Local', baseUrl: 'http://localhost:11434' });
      await renderWorkspace([conn], 'c1');

      expect(screen.getAllByText('Ollama Local').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/localhost/i).length).toBeGreaterThan(0);
    });

    it('shows status indicator for connected active model', async () => {
      const conn = makeConnection({ validation: { status: 'connected', checkedAt: '2025-01-01' } });
      await renderWorkspace([conn], 'c1');

      expect(screen.getByText(/connected/i)).toBeTruthy();
    });

    it('shows Change and Deactivate buttons for active model', async () => {
      const conn = makeConnection();
      await renderWorkspace([conn], 'c1');

      expect(screen.getByRole('button', { name: /change/i })).toBeTruthy();
      const deactivateButtons = screen.getAllByRole('button', { name: /deactivate/i });
      expect(deactivateButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('hides Change/Deactivate when no active connection', async () => {
      await renderWorkspace([], undefined);

      expect(screen.queryByRole('button', { name: /change/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /deactivate/i })).toBeNull();
    });
  });

  describe('saved connections list', () => {
    it('renders saved connections with Edit and Delete actions', async () => {
      const conn = makeConnection({ id: 'c1', name: 'Saved Model' });
      await renderWorkspace([conn], 'c1');

      expect(screen.getAllByText('Saved Model').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole('button', { name: /edit/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /delete/i })).toBeTruthy();
    });

    it('shows Deactivate for the active connection in the list', async () => {
      const conn = makeConnection({ id: 'c1', name: 'Active Model' });
      await renderWorkspace([conn], 'c1');

      const deactivateButtons = screen.getAllByRole('button', { name: /deactivate/i });
      expect(deactivateButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('does not show Deactivate for non-active connections in list', async () => {
      const conn = makeConnection({ id: 'c2', name: 'Inactive Model' });
      await renderWorkspace([conn], undefined);

      expect(screen.queryByRole('button', { name: /deactivate/i })).toBeNull();
    });

    it('shows route disclosure badge for each saved connection', async () => {
      const local = makeConnection({ id: 'c1', name: 'Local', baseUrl: 'http://localhost:8080' });
      const cloud = makeConnection({ id: 'c2', name: 'Cloud', baseUrl: 'https://api.openai.com' });
      await renderWorkspace([local, cloud], 'c1');

      expect(screen.getAllByText(/localhost/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/cloud/i).length).toBeGreaterThan(0);
    });
  });

  describe('editor form', () => {
    it('opens editor when Add Connection tab is clicked', async () => {
      await renderWorkspace([], undefined);

      clickTab(/add connection/i);

      expect(screen.getByLabelText(/name/i)).toBeTruthy();
      expect(screen.getByLabelText(/url/i)).toBeTruthy();
    });

    it('has password input for credential', async () => {
      await renderWorkspace([], undefined);

      clickTab(/add connection/i);

      const credentialInput = screen.getByLabelText(/credential/i);
      expect(credentialInput.getAttribute('type')).toBe('password');
    });

    it('has model ID input', async () => {
      await renderWorkspace([], undefined);

      clickTab(/add connection/i);

      expect(screen.getByLabelText(/model id/i)).toBeTruthy();
    });

    it('shows Test button in editor', async () => {
      await renderWorkspace([], undefined);

      clickTab(/add connection/i);

      expect(screen.getByRole('button', { name: /test/i })).toBeTruthy();
    });

    it('shows Activate button in editor', async () => {
      await renderWorkspace([], undefined);

      clickTab(/add connection/i);

      expect(screen.getByRole('button', { name: /activate/i })).toBeTruthy();
    });
  });

  describe('tabs', () => {
    it('renders Connections and Add connection tabs', async () => {
      await renderWorkspace([], undefined);

      expect(screen.getByRole('tab', { name: /connections/i })).toBeTruthy();
      expect(screen.getByRole('tab', { name: /add connection/i })).toBeTruthy();
    });

    it('defaults to Connections tab', async () => {
      await renderWorkspace([], undefined);

      const connectionsTab = screen.getByRole('tab', { name: /connections/i });
      expect(connectionsTab.getAttribute('aria-selected')).toBe('true');
    });

    it('switches to Add connection tab on click', async () => {
      await renderWorkspace([], undefined);

      clickTab(/add connection/i);

      const addTab = screen.getByRole('tab', { name: /add connection/i });
      expect(addTab.getAttribute('aria-selected')).toBe('true');
      expect(screen.getByLabelText(/name/i)).toBeTruthy();
    });
  });
});
