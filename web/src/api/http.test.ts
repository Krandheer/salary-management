import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, buildQueryString, requestJson } from './http';

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('buildQueryString', () => {
  it('joins defined params and skips undefined ones', () => {
    expect(buildQueryString({ page: 2, status: 'inactive', search: undefined })).toBe(
      '?page=2&status=inactive',
    );
  });

  it('returns an empty string when there are no params', () => {
    expect(buildQueryString({})).toBe('');
  });

  it('encodes values', () => {
    expect(buildQueryString({ search: 'a b&c' })).toBe('?search=a+b%26c');
  });
});

describe('requestJson', () => {
  it('returns the parsed body of a successful response', async () => {
    const fetchMock = stubFetch(Response.json({ ok: true }));

    await expect(requestJson<{ ok: boolean }>('/api/x')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/x', undefined);
  });

  it('throws an ApiError carrying status, code and field errors from the error body', async () => {
    stubFetch(
      Response.json(
        { error: { code: 'VALIDATION_FAILED', message: 'Bad', fieldErrors: { email: 'Invalid' } } },
        { status: 400 },
      ),
    );

    const failure = await requestJson('/api/x').catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
      message: 'Bad',
      fieldErrors: { email: 'Invalid' },
    });
  });

  it('throws an ApiError with a generic code when the error response is not JSON', async () => {
    stubFetch(new Response('<html>Bad gateway</html>', { status: 502 }));

    const failure = await requestJson('/api/x').catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ status: 502, code: 'UNKNOWN' });
  });

  it('throws an ApiError when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(requestJson('/api/x')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
});
