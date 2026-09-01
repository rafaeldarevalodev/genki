import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ModelConnection } from './model-connections';
import {
  MODEL_CONNECTIONS_DATABASE,
  MODEL_CONNECTIONS_DATABASE_VERSION,
  ModelConnectionsStorageError,
  createModelConnectionsRepository,
  openModelConnectionsDatabase,
} from './model-connections-db';

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

const draftConnection: ModelConnection = {
  ...validatedConnection,
  id: 'draft',
  name: 'Draft model',
  lifecycle: 'draft',
  validation: undefined,
};

function deleteDatabase(name = MODEL_CONNECTIONS_DATABASE) {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Database deletion blocked'));
  });
}

describe('model connections IndexedDB repository', () => {
  beforeEach(async () => {
    await deleteDatabase();
  });

  afterEach(async () => {
    await deleteDatabase();
  });

  it('upgrades an empty browser database to v1 with connection lifecycle indexes', async () => {
    const database = await openModelConnectionsDatabase();

    expect(database.version).toBe(MODEL_CONNECTIONS_DATABASE_VERSION);
    expect(database.objectStoreNames.contains('connections')).toBe(true);
    expect(database.objectStoreNames.contains('meta')).toBe(true);

    const transaction = database.transaction('connections', 'readonly');
    const store = transaction.objectStore('connections');
    expect(store.indexNames.contains('updatedAt')).toBe(true);
    expect(store.indexNames.contains('lifecycle')).toBe(true);
    database.close();
  });

  it('restores records and their active selection after reopening', async () => {
    const repository = createModelConnectionsRepository();
    await repository.save(validatedConnection, { active: true });
    await repository.save(draftConnection);

    const restored = await createModelConnectionsRepository().load();

    expect(restored).toEqual({
      connections: [draftConnection, validatedConnection],
      activeConnectionId: 'validated',
    });
  });

  it('rejects draft activation and clears the active ID when an active record is deleted', async () => {
    const repository = createModelConnectionsRepository();
    await repository.save(validatedConnection, { active: true });
    await repository.save(draftConnection);

    await expect(repository.activate(draftConnection.id)).rejects.toThrow('Only validated model connections can be activated.');
    await repository.delete(validatedConnection.id);

    expect(await repository.load()).toEqual({
      connections: [draftConnection],
      activeConnectionId: undefined,
    });
  });

  it('fails safely when the browser contains a newer database version', async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(MODEL_CONNECTIONS_DATABASE, MODEL_CONNECTIONS_DATABASE_VERSION + 1);
      request.onupgradeneeded = () => undefined;
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });

    await expect(openModelConnectionsDatabase()).rejects.toBeInstanceOf(ModelConnectionsStorageError);
  });
});
