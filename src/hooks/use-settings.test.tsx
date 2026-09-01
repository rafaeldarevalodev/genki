import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ModelConnection } from '@/lib/model-connections';
import {
  MODEL_CONNECTIONS_DATABASE,
  type ModelConnectionsRepository,
} from '@/lib/model-connections-db';
import {
  ModelConnectionsProvider,
  useModelConnections,
} from './use-settings';

const validatedConnection: ModelConnection = {
  id: 'validated',
  name: 'Validated model',
  baseUrl: 'http://localhost:11434',
  modelId: 'llama3.2',
  lifecycle: 'validated',
  validation: { status: 'connected', checkedAt: '2026-09-01T00:00:00.000Z' },
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const otherValidatedConnection: ModelConnection = {
  ...validatedConnection,
  id: 'other-validated',
  name: 'Other validated model',
};

function deleteDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(MODEL_CONNECTIONS_DATABASE);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function ConnectionState() {
  const { activate, activeConnectionId, connections, deactivate, deleteConnection, enabled, error, isLoaded, save } = useModelConnections();

  return (
    <>
      <output>{enabled ? 'enabled' : 'disabled'}</output>
      <output>{isLoaded ? 'connections loaded' : 'connections loading'}</output>
      <output>{activeConnectionId ?? 'no active connection'}</output>
      <output>{connections.map((connection) => connection.name).join(', ') || 'no connections'}</output>
      <output>{error ?? 'no storage error'}</output>
      <button onClick={() => void save(validatedConnection, { active: true })}>Save active</button>
      <button onClick={() => void activate(validatedConnection.id)}>Activate validated</button>
      <button onClick={() => void deactivate()}>Deactivate</button>
      <button onClick={() => void deleteConnection(validatedConnection.id)}>Delete validated</button>
    </>
  );
}

describe('ModelConnectionsProvider', () => {
  beforeEach(async () => {
    await deleteDatabase();
  });

  afterEach(async () => {
    await deleteDatabase();
  });

  it('is disabled by default and does not select a model', () => {
    render(
      <ModelConnectionsProvider>
        <ConnectionState />
      </ModelConnectionsProvider>,
    );

    expect(screen.getByText('disabled')).toBeTruthy();
    expect(screen.getByText('no active connection')).toBeTruthy();
  });

  it('persists an explicitly activated validated connection and can deactivate it', async () => {
    render(
      <ModelConnectionsProvider enabled>
        <ConnectionState />
      </ModelConnectionsProvider>,
    );

    await waitFor(() => expect(screen.getByText('connections loaded')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Save active' }));

    await waitFor(() => expect(screen.getByText('validated')).toBeTruthy());
    expect(screen.getByText('Validated model')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));

    await waitFor(() => expect(screen.getByText('no active connection')).toBeTruthy());
    expect(screen.getByText('Validated model')).toBeTruthy();
  });

  it('retains an unsaved connection in memory when storage fails', async () => {
    const failingRepository: ModelConnectionsRepository = {
      load: async () => ({ connections: [], activeConnectionId: undefined }),
      save: async () => { throw new Error('unavailable'); },
      activate: async () => undefined,
      deactivate: async () => undefined,
      delete: async () => undefined,
    };

    render(
      <ModelConnectionsProvider enabled repository={failingRepository}>
        <ConnectionState />
      </ModelConnectionsProvider>,
    );

    await waitFor(() => expect(screen.getByText('connections loaded')).toBeTruthy());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save active' }));
    });

    await waitFor(() => expect(screen.getByText('Validated model')).toBeTruthy());
    expect(screen.getByText('Model connection was not saved.')).toBeTruthy();
    expect(screen.getByText('no active connection')).toBeTruthy();
  });

  it('retains the visible active connection when activation storage fails', async () => {
    const failingRepository: ModelConnectionsRepository = {
      load: async () => ({ connections: [validatedConnection, otherValidatedConnection], activeConnectionId: otherValidatedConnection.id }),
      save: async () => undefined,
      activate: async () => { throw new Error('unavailable'); },
      deactivate: async () => undefined,
      delete: async () => undefined,
    };

    render(
      <ModelConnectionsProvider enabled repository={failingRepository}>
        <ConnectionState />
      </ModelConnectionsProvider>,
    );

    await waitFor(() => expect(screen.getByText(otherValidatedConnection.id)).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Activate validated' }));

    await waitFor(() => expect(screen.getByText('Model connection could not be activated.')).toBeTruthy());
    expect(screen.getByText(otherValidatedConnection.id)).toBeTruthy();
  });

  it('retains the visible active connection when deactivation storage fails', async () => {
    const failingRepository: ModelConnectionsRepository = {
      load: async () => ({ connections: [validatedConnection], activeConnectionId: validatedConnection.id }),
      save: async () => undefined,
      activate: async () => undefined,
      deactivate: async () => { throw new Error('unavailable'); },
      delete: async () => undefined,
    };

    render(
      <ModelConnectionsProvider enabled repository={failingRepository}>
        <ConnectionState />
      </ModelConnectionsProvider>,
    );

    await waitFor(() => expect(screen.getByText(validatedConnection.id)).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));

    await waitFor(() => expect(screen.getByText('Model connection could not be deactivated.')).toBeTruthy());
    expect(screen.getByText(validatedConnection.id)).toBeTruthy();
  });

  it('retains visible records and selection when deletion storage fails', async () => {
    const failingRepository: ModelConnectionsRepository = {
      load: async () => ({ connections: [validatedConnection], activeConnectionId: validatedConnection.id }),
      save: async () => undefined,
      activate: async () => undefined,
      deactivate: async () => undefined,
      delete: async () => { throw new Error('unavailable'); },
    };

    render(
      <ModelConnectionsProvider enabled repository={failingRepository}>
        <ConnectionState />
      </ModelConnectionsProvider>,
    );

    await waitFor(() => expect(screen.getByText(validatedConnection.id)).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Delete validated' }));

    await waitFor(() => expect(screen.getByText('Model connection could not be deleted.')).toBeTruthy());
    expect(screen.getByText(validatedConnection.id)).toBeTruthy();
    expect(screen.getByText('Validated model')).toBeTruthy();
  });
});
