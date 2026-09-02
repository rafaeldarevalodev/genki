export type ConnectionLifecycle = 'draft' | 'validated';

export type ConnectionStatus =
  | 'connected'
  | 'auth'
  | 'incompatible'
  | 'offline'
  | 'timeout'
  | 'blocked';

export type RouteDisclosure = 'localhost' | 'local-network' | 'cloud';

export interface ConnectionValidation {
  status: ConnectionStatus;
  checkedAt?: string;
  httpStatus?: number;
}

export interface ModelConnection {
  id: string;
  name: string;
  baseUrl: string;
  modelId: string;
  credential?: string;
  maxTokens?: number;
  lifecycle: ConnectionLifecycle;
  validation?: ConnectionValidation;
  createdAt: string;
  updatedAt: string;
}

const invalidUrlMessage = 'Model connection URLs must be HTTP(S) URLs without credentials, query parameters, or fragments.';

export function normalizeConnectionUrl(input: string): string {
  let url: URL;

  try {
    url = new URL(input.trim());
  } catch {
    throw new Error(invalidUrlMessage);
  }

  if (
    !['http:', 'https:'].includes(url.protocol)
    || url.username
    || url.password
    || url.search
    || url.hash
  ) {
    throw new Error(invalidUrlMessage);
  }

  url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString().replace(/\/$/, '');
}

export function getRouteDisclosure(baseUrl: string): RouteDisclosure {
  const hostname = new URL(baseUrl).hostname.toLowerCase();

  if (hostname === 'localhost' || hostname === '::1') {
    return 'localhost';
  }

  if (
    hostname.startsWith('10.')
    || hostname.startsWith('192.168.')
    || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  ) {
    return 'local-network';
  }

  return 'cloud';
}

export function redactConnection(connection: ModelConnection): ModelConnection {
  return { ...connection, credential: undefined };
}

export function classifyConnectionStatus({
  httpStatus,
  errorName,
}: {
  httpStatus?: number;
  errorName?: string;
}): ConnectionStatus {
  if (httpStatus === 401 || httpStatus === 403) return 'auth';
  if (httpStatus === 404) return 'incompatible';
  if (errorName === 'AbortError') return 'timeout';
  if (errorName === 'TypeError') return 'blocked';
  return 'offline';
}
