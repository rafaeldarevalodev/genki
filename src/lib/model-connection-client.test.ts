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

function repositoryWithInactiveValidatedConnection(): ModelConnectionsRepository {
  return {
    load: async () => ({ connections: [activeConnection], activeConnectionId: undefined }),
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

  it('returns an explicit unavailable result without requesting an inactive validated connection', async () => {
    const fetchImpl = vi.fn();
    const client = createModelConnectionClient({ repository: repositoryWithInactiveValidatedConnection(), fetchImpl });

    await expect(client.generateCards({ text: 'Hello', images: [], mode: 'words' }))
      .rejects.toMatchObject({ message: 'No validated active browser model connection is available.' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('chat method', () => {
  it('sends a full messages array through the validated browser connection', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: '¡Hola! ¿Cómo estás?' } }],
    })));
    const client = createModelConnectionClient({ repository: repositoryWith(activeConnection), fetchImpl });

    const result = await client.chat({
      messages: [
        { role: 'system', content: 'You are a Spanish tutor.' },
        { role: 'user', content: 'Hello!' },
      ],
      temperature: 0.7,
      maxTokens: 600,
    });

    expect(result).toBe('¡Hola! ¿Cómo estás?');
    expect(fetchImpl).toHaveBeenCalledWith('https://models.example.test/v1/chat/completions', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        model: 'gpt-test',
        temperature: 0.7,
        max_tokens: 600,
        messages: [
          { role: 'system', content: 'You are a Spanish tutor.' },
          { role: 'user', content: 'Hello!' },
        ],
      }),
    }));
  });

  it('throws ModelConnectionUnavailableError when no active validated connection exists', async () => {
    const fetchImpl = vi.fn();
    const client = createModelConnectionClient({ repository: repositoryWith(), fetchImpl });

    await expect(client.chat({
      messages: [{ role: 'user', content: 'Hi' }],
    })).rejects.toMatchObject({ message: 'No validated active browser model connection is available.' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('roleplay functions', () => {
  it('startRoleplay sends scenario prompt and returns first message', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: 'Hello! Welcome to our conversation practice. Let\'s begin! [tip] Try speaking slowly at first.' } }],
    })));
    const client = createModelConnectionClient({ repository: repositoryWith(activeConnection), fetchImpl });

    const result = await client.startRoleplay({
      vocabulary: ['hello', 'goodbye'],
      scenarioContext: 'Practice greeting vocabulary',
    });

    expect(result.aiResponse).toContain('Hello!');
    expect(result.aiResponse).toContain('[tip]');
    expect(fetchImpl).toHaveBeenCalledWith('https://models.example.test/v1/chat/completions', expect.objectContaining({
      body: expect.stringContaining('You are Maya'),
    }));
  });

  it('continueRoleplay sends chat history and returns AI response', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: 'Great job using those words! [tip] Remember to smile when greeting.' } }],
    })));
    const client = createModelConnectionClient({ repository: repositoryWith(activeConnection), fetchImpl });

    const result = await client.continueRoleplay({
      vocabulary: ['hello', 'goodbye'],
      scenarioContext: 'Practice greeting vocabulary',
      chatHistory: [
        { role: 'assistant', text: 'Hello! Welcome!' },
        { role: 'user', text: 'Hi there!' },
      ],
      userMessage: 'How are you?',
    });

    expect(result.aiResponse).toContain('Great job');
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.messages).toHaveLength(4); // system + 2 history + 1 user
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[body.messages.length - 1].content).toContain('How are you?');
  });

  it('evaluateRoleplay returns parsed score and feedback', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: '{"score": 85, "feedback": "Good vocabulary usage!", "tips": ["Speak more slowly", "Use more connectors", "Great pronunciation"]}' } }],
    })));
    const client = createModelConnectionClient({ repository: repositoryWith(activeConnection), fetchImpl });

    const result = await client.evaluateRoleplay({
      userInput: 'Hello! How are you today?',
      scenarioContext: 'Practice greeting vocabulary',
      vocabulary: ['hello', 'goodbye'],
    });

    expect(result.score).toBe(85);
    expect(result.feedback).toBe('Good vocabulary usage!');
    expect(result.tips).toHaveLength(3);
  });

  it('evaluateRoleplay handles malformed JSON gracefully', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: 'The response was decent. No JSON here.' } }],
    })));
    const client = createModelConnectionClient({ repository: repositoryWith(activeConnection), fetchImpl });

    await expect(client.evaluateRoleplay({
      userInput: 'Hello!',
      scenarioContext: 'Greeting practice',
    })).rejects.toThrow('Failed to parse evaluation response');
  });

  it('roleplay functions throw ModelConnectionUnavailableError without connection', async () => {
    const fetchImpl = vi.fn();
    const client = createModelConnectionClient({ repository: repositoryWith(), fetchImpl });

    await expect(client.startRoleplay({ vocabulary: ['hi'], scenarioContext: 'test' }))
      .rejects.toMatchObject({ message: 'No validated active browser model connection is available.' });
    await expect(client.continueRoleplay({ vocabulary: ['hi'], scenarioContext: 'test', chatHistory: [], userMessage: 'hi' }))
      .rejects.toMatchObject({ message: 'No validated active browser model connection is available.' });
    await expect(client.evaluateRoleplay({ userInput: 'hi', scenarioContext: 'test' }))
      .rejects.toMatchObject({ message: 'No validated active browser model connection is available.' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('generateQuizQuestions method', () => {
  it('generates quiz question with distractors through the validated browser connection', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: '{"question": "What does \\"Bonjour\\" mean?", "distractors": ["Goodbye", "Thank you", "Please"]}' } }],
    })));
    const client = createModelConnectionClient({ repository: repositoryWith(activeConnection), fetchImpl });

    const result = await client.generateQuizQuestions({
      deckId: 'test-deck',
      cardFront: 'Bonjour',
      correctAnswer: 'Hello',
    });

    expect(result.question).toBe('What does "Bonjour" mean?');
    expect(result.distractors).toEqual(['Goodbye', 'Thank you', 'Please']);
    expect(fetchImpl).toHaveBeenCalledWith('https://models.example.test/v1/chat/completions', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('pedagogical quiz designer'),
    }));
  });

  it('throws ModelConnectionUnavailableError without connection', async () => {
    const fetchImpl = vi.fn();
    const client = createModelConnectionClient({ repository: repositoryWith(), fetchImpl });

    await expect(client.generateQuizQuestions({
      deckId: 'test',
      cardFront: 'Hello',
      correctAnswer: 'Hola',
    })).rejects.toMatchObject({ message: 'No validated active browser model connection is available.' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('handles malformed JSON response gracefully', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: 'The question is: what does it mean?' } }],
    })));
    const client = createModelConnectionClient({ repository: repositoryWith(activeConnection), fetchImpl });

    await expect(client.generateQuizQuestions({
      deckId: 'test',
      cardFront: 'Hello',
      correctAnswer: 'Hola',
    })).rejects.toThrow('Failed to parse quiz JSON');
  });
});

describe('explorePhrase method', () => {
  it('evaluates phrase correctness through the validated browser connection', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: '{"isCorrect": true, "feedback": "Great usage of the chunk!", "annotatedSentence": "The story went beyond just reading."}' } }],
    })));
    const client = createModelConnectionClient({ repository: repositoryWith(activeConnection), fetchImpl });

    const result = await client.explorePhrase({
      chunk: 'beyond',
      userSentence: 'The story went beyond just reading.',
    });

    expect(result.isCorrect).toBe(true);
    expect(result.feedback).toBe('Great usage of the chunk!');
    expect(result.annotatedSentence).toBe('The story went beyond just reading.');
    expect(fetchImpl).toHaveBeenCalledWith('https://models.example.test/v1/chat/completions', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('Dr. James Morrison'),
    }));
  });

  it('returns feedback with defaults for missing fields', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: '{"isCorrect": false}' } }],
    })));
    const client = createModelConnectionClient({ repository: repositoryWith(activeConnection), fetchImpl });

    const result = await client.explorePhrase({
      chunk: 'beyond',
      userSentence: 'The story went beyond reading.',
    });

    expect(result.isCorrect).toBe(false);
    expect(result.feedback).toBe('Good attempt!');
    expect(result.annotatedSentence).toBe('The story went beyond reading.');
  });

  it('throws ModelConnectionUnavailableError without connection', async () => {
    const fetchImpl = vi.fn();
    const client = createModelConnectionClient({ repository: repositoryWith(), fetchImpl });

    await expect(client.explorePhrase({
      chunk: 'beyond',
      userSentence: 'Test sentence',
    })).rejects.toMatchObject({ message: 'No validated active browser model connection is available.' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
