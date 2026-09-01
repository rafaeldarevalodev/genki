import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CreatorPage from './page';

const { addDeck, createClient, generateCards, classifyTextCefr, push, toast } = vi.hoisted(() => ({
  addDeck: vi.fn(),
  createClient: vi.fn(),
  generateCards: vi.fn(),
  classifyTextCefr: vi.fn(),
  push: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/hooks/use-decks', () => ({ useDecks: () => ({ addDeck, isLoaded: true }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/lib/model-connection-client', () => ({
  createModelConnectionClient: createClient,
}));

const generatedCards = {
  cards: [{
    front: 'Hello',
    back: 'Hola',
    ipa: '/həˈloʊ/',
    spanish_phonetic: 'jelóu',
    explanation: 'Greeting',
    category: 'filler',
    voice: 'af_bella',
  }],
};

function renderCreator() {
  render(<CreatorPage />);
  return waitFor(() => expect(screen.getByPlaceholderText('ej., Análisis de Historia...')).not.toBeNull());
}

async function submitCreator() {
  fireEvent.change(screen.getByPlaceholderText('ej., Análisis de Historia...'), { target: { value: 'Greetings' } });
  fireEvent.change(screen.getByPlaceholderText('Pega texto o imágenes (Ctrl+V) aquí...'), { target: { value: 'Hello' } });
  fireEvent.click(screen.getByRole('button', { name: /Generar Deck de Chunks/ }));
}

describe('CreatorPage model connection recovery', () => {
  beforeEach(() => {
    addDeck.mockReset();
    classifyTextCefr.mockReset();
    createClient.mockReset();
    generateCards.mockReset();
    push.mockReset();
    toast.mockReset();
    createClient.mockReturnValue({ classifyTextCefr, generateCards });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('generates cards when optional CEFR classification rejects', async () => {
    classifyTextCefr.mockRejectedValueOnce(new Error('CEFR unavailable'));
    generateCards.mockResolvedValueOnce(generatedCards);
    await renderCreator();

    await submitCreator();

    await waitFor(() => expect(addDeck).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Greetings',
      cards: expect.arrayContaining([expect.objectContaining({ front: 'Hello', back: 'Hola' })]),
      cefrLevel: undefined,
    })));
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/creator\/analysis\//));
  });

  it('recovers loading and shows an unavailable-connection toast', async () => {
    generateCards.mockRejectedValueOnce(new Error('No validated active browser model connection is available.'));
    await renderCreator();

    await submitCreator();

    const analyzeButton = screen.getByRole('button', { name: 'Analizando...' }) as HTMLButtonElement;
    expect(analyzeButton.disabled).toBe(true);
    await waitFor(() => {
      const generateButton = screen.getByRole('button', { name: /Generar Deck de Chunks/ }) as HTMLButtonElement;
      expect(generateButton.disabled).toBe(false);
    });
    expect(toast).toHaveBeenCalledWith({
      title: 'Error',
      description: 'No validated active browser model connection is available.',
      variant: 'destructive',
    });
    expect(addDeck).not.toHaveBeenCalled();
  });

  it('recovers loading and shows an HTTP completion failure toast', async () => {
    generateCards.mockRejectedValueOnce(new Error('The browser model request failed (503).'));
    await renderCreator();

    await submitCreator();

    await waitFor(() => {
      const generateButton = screen.getByRole('button', { name: /Generar Deck de Chunks/ }) as HTMLButtonElement;
      expect(generateButton.disabled).toBe(false);
    });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      description: 'The browser model request failed (503).',
      variant: 'destructive',
    }));
  });

  it('recovers loading and shows a malformed completion toast', async () => {
    generateCards.mockRejectedValueOnce(new Error('The model returned an invalid JSON response.'));
    await renderCreator();

    await submitCreator();

    await waitFor(() => {
      const generateButton = screen.getByRole('button', { name: /Generar Deck de Chunks/ }) as HTMLButtonElement;
      expect(generateButton.disabled).toBe(false);
    });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      description: 'The model returned an invalid JSON response.',
      variant: 'destructive',
    }));
  });
});
