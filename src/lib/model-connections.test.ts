import { describe, expect, it } from 'vitest';
import {
  classifyConnectionStatus,
  getRouteDisclosure,
  normalizeConnectionUrl,
  redactConnection,
  type ModelConnection,
} from './model-connections';

const validatedConnection: ModelConnection = {
  id: 'connection-1',
  name: 'Local model',
  baseUrl: 'http://localhost:11434',
  modelId: 'llama3.2',
  credential: 'secret-token',
  lifecycle: 'validated',
  validation: { status: 'connected', checkedAt: '2026-09-01T00:00:00.000Z' },
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

describe('model connection domain', () => {
  it('normalizes HTTP(S) endpoint URLs without a trailing slash', () => {
    expect(normalizeConnectionUrl(' HTTPS://api.example.com/v1/ ')).toBe('https://api.example.com/v1');
    expect(normalizeConnectionUrl('http://localhost:11434/')).toBe('http://localhost:11434');
  });

  it.each([
    'ftp://models.example.com',
    'https://user:password@models.example.com',
    'https://models.example.com?token=secret',
    'https://models.example.com#secret',
  ])('rejects unsafe or unsupported endpoint URL %s', (url) => {
    expect(() => normalizeConnectionUrl(url)).toThrow('Model connection URLs must be HTTP(S) URLs without credentials, query parameters, or fragments.');
  });

  it.each([
    ['http://localhost:11434', 'localhost'],
    ['http://192.168.1.10:8080', 'local-network'],
    ['https://api.example.com', 'cloud'],
  ] as const)('discloses the %s route category', (baseUrl, expected) => {
    expect(getRouteDisclosure(baseUrl)).toBe(expected);
  });

  it('redacts credentials from records intended for UI diagnostics', () => {
    expect(redactConnection(validatedConnection)).toEqual({
      ...validatedConnection,
      credential: undefined,
    });
  });

  it.each([
    [401, undefined, 'auth'],
    [403, undefined, 'auth'],
    [404, undefined, 'incompatible'],
    [undefined, 'AbortError', 'timeout'],
    [undefined, 'TypeError', 'blocked'],
  ] as const)('classifies endpoint result %s / %s as %s', (httpStatus, errorName, expected) => {
    expect(classifyConnectionStatus({ httpStatus, errorName })).toBe(expected);
  });
});
