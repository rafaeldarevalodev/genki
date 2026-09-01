import { classifyConnectionStatus, type ConnectionStatus } from './model-connections';

export interface ValidateConnectionOptions {
  baseUrl: string;
  credential?: string;
  signal?: AbortSignal;
}

export interface ValidationResult {
  status: ConnectionStatus;
  checkedAt: string;
  httpStatus?: number;
}

const VALIDATION_TIMEOUT_MS = 15_000;

export async function validateModelConnection(
  options: ValidateConnectionOptions,
): Promise<ValidationResult> {
  const { baseUrl, credential, signal: externalSignal } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS);

  // Chain external signal if provided
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  const checkedAt = new Date().toISOString();

  try {
    // Step 1: Discovery — GET /models
    const modelsHeaders: Record<string, string> = {};
    if (credential) {
      modelsHeaders['Authorization'] = `Bearer ${credential}`;
    }

    const modelsResponse = await fetch(`${baseUrl}/models`, {
      signal: controller.signal,
      headers: modelsHeaders,
    });

    if (!modelsResponse.ok) {
      return {
        status: classifyConnectionStatus({ httpStatus: modelsResponse.status }),
        checkedAt,
        httpStatus: modelsResponse.status,
      };
    }

    // Step 2: Probe — POST /chat/completions
    const probeResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...modelsHeaders,
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 }),
    });

    if (!probeResponse.ok) {
      return {
        status: classifyConnectionStatus({ httpStatus: probeResponse.status }),
        checkedAt,
        httpStatus: probeResponse.status,
      };
    }

    return { status: 'connected', checkedAt };
  } catch (error) {
    const errorName = error instanceof DOMException ? error.name : undefined;
    const isErrorType = error instanceof TypeError;

    return {
      status: classifyConnectionStatus({
        httpStatus: undefined,
        errorName: isErrorType ? 'TypeError' : errorName,
      }),
      checkedAt,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
