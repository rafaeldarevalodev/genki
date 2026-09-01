import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateModelConnection } from './model-connection-validator';

const VALID_BASE = 'http://localhost:11434';

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    return handler(url as string, init as RequestInit);
  });
}

describe('validateModelConnection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns connected when discovery and probe succeed', async () => {
    mockFetch((url) => {
      if (url.endsWith('/models')) {
        return new Response(JSON.stringify({ data: [{ id: 'gpt-4' }] }), { status: 200 });
      }
      if (url.endsWith('/chat/completions')) {
        return new Response(JSON.stringify({ choices: [] }), { status: 200 });
      }
      return new Response('Not found', { status: 404 });
    });

    const result = await validateModelConnection({ baseUrl: VALID_BASE });
    expect(result.status).toBe('connected');
  });

  it('sends Authorization header only when credential is provided', async () => {
    let capturedInit: RequestInit | undefined;
    mockFetch((url, init) => {
      if (url.endsWith('/models')) {
        capturedInit = init;
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({ choices: [] }), { status: 200 });
    });

    await validateModelConnection({ baseUrl: VALID_BASE, credential: 'sk-test' });
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers?.Authorization).toBe('Bearer sk-test');
  });

  it('does not send Authorization when credential is absent', async () => {
    let capturedInit: RequestInit | undefined;
    mockFetch((url, init) => {
      if (url.endsWith('/models')) {
        capturedInit = init;
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({ choices: [] }), { status: 200 });
    });

    await validateModelConnection({ baseUrl: VALID_BASE });
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers?.Authorization).toBeUndefined();
  });

  it('maps 401 to auth status', async () => {
    mockFetch(() => new Response('Unauthorized', { status: 401 }));
    const result = await validateModelConnection({ baseUrl: VALID_BASE });
    expect(result.status).toBe('auth');
  });

  it('maps 403 to auth status', async () => {
    mockFetch(() => new Response('Forbidden', { status: 403 }));
    const result = await validateModelConnection({ baseUrl: VALID_BASE });
    expect(result.status).toBe('auth');
  });

  it('maps 404 to incompatible status', async () => {
    mockFetch(() => new Response('Not found', { status: 404 }));
    const result = await validateModelConnection({ baseUrl: VALID_BASE });
    expect(result.status).toBe('incompatible');
  });

  it('maps AbortError to timeout status', async () => {
    mockFetch(() => {
      const error = new DOMException('The operation was aborted', 'AbortError');
      return Promise.reject(error);
    });
    const result = await validateModelConnection({ baseUrl: VALID_BASE });
    expect(result.status).toBe('timeout');
  });

  it('maps TypeError to blocked status (CORS/network)', async () => {
    mockFetch(() => {
      return Promise.reject(new TypeError('Failed to fetch'));
    });
    const result = await validateModelConnection({ baseUrl: VALID_BASE });
    expect(result.status).toBe('blocked');
  });

  it('returns offline for other network errors', async () => {
    mockFetch(() => {
      return Promise.reject(new Error('Network error'));
    });
    const result = await validateModelConnection({ baseUrl: VALID_BASE });
    expect(result.status).toBe('offline');
  });

  it('configures 15-second timeout on internal AbortController', async () => {
    let timeoutDuration: number | undefined;
    const originalSetTimeout = globalThis.setTimeout;

    mockFetch(() => {
      // Capture the timeout set by the validator
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    });

    // Spy on setTimeout to capture the timeout value
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn, ms) => {
      timeoutDuration = ms as number;
      return originalSetTimeout(fn, 0); // resolve immediately
    });

    await validateModelConnection({ baseUrl: VALID_BASE });
    expect(timeoutDuration).toBe(15_000);
  });

  it('uses AbortController signal for fetch', async () => {
    let capturedSignal: AbortSignal | undefined;
    mockFetch((url, init) => {
      capturedSignal = init?.signal;
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    });

    await validateModelConnection({ baseUrl: VALID_BASE });
    expect(capturedSignal).toBeInstanceOf(AbortSignal);
  });

  it('includes httpStatus in result for non-200 responses', async () => {
    mockFetch(() => new Response('Service Unavailable', { status: 503 }));
    const result = await validateModelConnection({ baseUrl: VALID_BASE });
    expect(result.httpStatus).toBe(503);
  });

  it('sets checkedAt timestamp', async () => {
    mockFetch(() => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    const result = await validateModelConnection({ baseUrl: VALID_BASE });
    expect(result.checkedAt).toBeTruthy();
    expect(new Date(result.checkedAt!).getTime()).not.toBeNaN();
  });

  it('can be cancelled externally', async () => {
    const controller = new AbortController();
    mockFetch((_url, init) => {
      return new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    const promise = validateModelConnection({ baseUrl: VALID_BASE, signal: controller.signal });
    controller.abort();
    const result = await promise;
    expect(result.status).toBe('timeout');
  });
});
