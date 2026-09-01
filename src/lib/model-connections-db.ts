import type { ModelConnection } from './model-connections';

export const MODEL_CONNECTIONS_DATABASE = 'genki-model-connections';
export const MODEL_CONNECTIONS_DATABASE_VERSION = 1;

const connectionsStore = 'connections';
const metaStore = 'meta';
const activeConnectionIdKey = 'activeConnectionId';

export class ModelConnectionsStorageError extends Error {
  constructor(message = 'Model connection storage is unavailable.') {
    super(message);
    this.name = 'ModelConnectionsStorageError';
  }
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new ModelConnectionsStorageError());
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new ModelConnectionsStorageError());
    transaction.onabort = () => reject(transaction.error ?? new ModelConnectionsStorageError());
  });
}

export function openModelConnectionsDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new ModelConnectionsStorageError());
      return;
    }

    const request = indexedDB.open(MODEL_CONNECTIONS_DATABASE, MODEL_CONNECTIONS_DATABASE_VERSION);
    request.onupgradeneeded = (event) => {
      const database = request.result;
      if (event.oldVersion === 0) {
        const connections = database.createObjectStore(connectionsStore, { keyPath: 'id' });
        connections.createIndex('updatedAt', 'updatedAt');
        connections.createIndex('lifecycle', 'lifecycle');
        database.createObjectStore(metaStore, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new ModelConnectionsStorageError('Model connection storage cannot be opened safely.'));
  });
}

export interface ModelConnectionsState {
  connections: ModelConnection[];
  activeConnectionId?: string;
}

export interface SaveConnectionOptions {
  active?: boolean;
}

export interface ModelConnectionsRepository {
  load(): Promise<ModelConnectionsState>;
  save(connection: ModelConnection, options?: SaveConnectionOptions): Promise<void>;
  activate(connectionId: string): Promise<void>;
  deactivate(): Promise<void>;
  delete(connectionId: string): Promise<void>;
}

export function createModelConnectionsRepository(): ModelConnectionsRepository {
  return {
    async load() {
      const database = await openModelConnectionsDatabase();
      try {
        const transaction = database.transaction([connectionsStore, metaStore], 'readonly');
        const connections = await requestResult(
          transaction.objectStore(connectionsStore).index('updatedAt').getAll(),
        );
        const active = await requestResult<{ key: string; value?: string } | undefined>(
          transaction.objectStore(metaStore).get(activeConnectionIdKey),
        );
        await transactionComplete(transaction);
        return { connections, activeConnectionId: active?.value };
      } catch {
        throw new ModelConnectionsStorageError();
      } finally {
        database.close();
      }
    },

    async save(connection, { active = false } = {}) {
      if (active && connection.lifecycle !== 'validated') {
        throw new Error('Only validated model connections can be activated.');
      }

      const database = await openModelConnectionsDatabase();
      let transaction: IDBTransaction | undefined;
      try {
        transaction = database.transaction([connectionsStore, metaStore], 'readwrite');
        transaction.objectStore(connectionsStore).put(connection);
        if (active) {
          transaction.objectStore(metaStore).put({ key: activeConnectionIdKey, value: connection.id });
        }
        await transactionComplete(transaction);
      } catch (error) {
        if (transaction?.error === null) transaction.abort();
        if (error instanceof Error && error.message === 'Only validated model connections can be activated.') throw error;
        throw new ModelConnectionsStorageError();
      } finally {
        database.close();
      }
    },

    async activate(connectionId) {
      const database = await openModelConnectionsDatabase();
      try {
        const transaction = database.transaction([connectionsStore, metaStore], 'readwrite');
        const connection = await requestResult<ModelConnection | undefined>(
          transaction.objectStore(connectionsStore).get(connectionId),
        );
        if (connection?.lifecycle !== 'validated') {
          transaction.abort();
          throw new Error('Only validated model connections can be activated.');
        }
        transaction.objectStore(metaStore).put({ key: activeConnectionIdKey, value: connectionId });
        await transactionComplete(transaction);
      } catch (error) {
        if (error instanceof Error && error.message === 'Only validated model connections can be activated.') throw error;
        throw new ModelConnectionsStorageError();
      } finally {
        database.close();
      }
    },

    async deactivate() {
      const database = await openModelConnectionsDatabase();
      try {
        const transaction = database.transaction(metaStore, 'readwrite');
        transaction.objectStore(metaStore).delete(activeConnectionIdKey);
        await transactionComplete(transaction);
      } catch {
        throw new ModelConnectionsStorageError();
      } finally {
        database.close();
      }
    },

    async delete(connectionId) {
      const database = await openModelConnectionsDatabase();
      let transaction: IDBTransaction | undefined;
      try {
        transaction = database.transaction([connectionsStore, metaStore], 'readwrite');
        const meta = await requestResult<{ key: string; value?: string } | undefined>(
          transaction.objectStore(metaStore).get(activeConnectionIdKey),
        );
        transaction.objectStore(connectionsStore).delete(connectionId);
        if (meta?.value === connectionId) {
          transaction.objectStore(metaStore).delete(activeConnectionIdKey);
        }
        await transactionComplete(transaction);
      } catch {
        if (transaction?.error === null) transaction.abort();
        throw new ModelConnectionsStorageError();
      } finally {
        database.close();
      }
    },
  };
}
