export class ApiError extends Error {
  /** `data` is the parsed response body (e.g. per-field `errors`), or null. */
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * JSON fetch wrapper for the app's API routes. Resolves with the parsed body,
 * or throws ApiError when the request fails, the status is not ok, or the
 * body says `success: false`.
 */
export async function apiFetch(url, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Network error — check your connection and try again.', 0);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON response; handled below.
  }

  if (!res.ok || !data || data.success === false) {
    const fallback =
      res.status === 401 ? 'Your sign-in has expired. Please sign in again.' : `Request failed (${res.status}).`;
    throw new ApiError(data?.message || fallback, res.status, data);
  }
  return data;
}
