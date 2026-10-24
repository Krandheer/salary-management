export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors?: Record<string, string>,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type QueryParams = Record<string, string | number | boolean | undefined>;

/** Builds "?a=1&b=2" from the defined params, or "" when there are none. */
export function buildQueryString(params: QueryParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string; fieldErrors?: Record<string, string> };
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => undefined)) as ErrorEnvelope | undefined;
  const detail = body?.error;
  return new ApiError(
    response.status,
    detail?.code ?? 'UNKNOWN',
    detail?.message ?? `The request failed (${response.status})`,
    detail?.fieldErrors,
    body,
  );
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server');
  }
  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as T;
}
