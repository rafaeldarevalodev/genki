import { describe, expect, it, vi } from 'vitest';
import type { ModelConnection } from './model-connections';
import type { ModelConnectionsRepository } from './model-connections-db';
import { createModelConnectionClient } from './model-connection-client';

const activeConnection: ModelConnection = {
  id: 'active',
  name: 'Browser model',
  baseUrl: 'https://models.example.test/v1',
  modelId: 'gpt-test',
  credential: 'browser-only-secret',
  lifecycle: 'validated',
  validation: { status: 'connected' },
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

function repositoryWith(connection?: ModelConnection): ModelConnectionsRepository {
  return {
    load: async () => ({ connections: connection ? [connection] : [], activeConnectionId: connection?.id }),
    save: async () => undefined,
    activate: async () => undefined,
    deactivate: async () => undefined,
    delete: async () => undefined,
  };
}

describe('browser model connection client', () => {
  it('generates cards and classifies CEFR through the selected validated browser connection', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: '[{"front":"Hello","back":"Hola","ipa":"/həˈloʊ/","spanish_phonetic":"jelóu","explanation":"Saludo","category":"filler"}]' } }],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: '{"cefrLevel":"A2","justification":"Simple present tense."}' } }],
      })));
    const client = createModelConnectionClient({ repository: repositoryWith(activeConnection), fetchImpl });

    const cards = await client.generateCards({ text: 'Hello', images: [], mode: 'chunks' });
    const cefr = await client.classifyTextCefr({ text: 'Hello' });

    expect(cards.cards).toMatchObject([{ front: 'Hello', back: 'Hola', category: 'filler' }]);
    expect(cefr).toEqual({ cefrLevel: 'A2', justification: 'Simple present tense.' });
    expect(fetchImpl).toHaveBeenNthCalledWith(1, 'https://models.example.test/v1/chat/completions', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer browser-only-secret' }),
    }));
    expect(fetchImpl).toHaveBeenNthCalledWith(2, 'https://models.example.test/v1/chat/completions', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer browser-only-secret' }),
    }));
  });

  it('returns an explicit unavailable result instead of falling back when no validated active connection exists', async () => {
    const fetchImpl = vi.fn();
    const client = createModelConnectionClient({ repository: repositoryWith({ ...activeConnection, lifecycle: 'draft' }), fetchImpl });

    await expect(client.generateCards({ text: 'Hello', images: [], mode: 'words' }))
      .rejects.toMatchObject({ message: 'No validated active browser model connection is available.' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
