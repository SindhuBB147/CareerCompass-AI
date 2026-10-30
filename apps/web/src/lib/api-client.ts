// Shared fetch helper for the Nest API (proxied through Next's /api/v1
// rewrite — see next.config.js). This is the first shared API client in
// the app; existing pages that call the backend do so with raw inline
// fetch() calls, but the AI Counsellor module has enough call sites
// (chat, streaming, sessions, feedback, admin knowledge management) that
// duplicating auth-header/error-envelope handling in each page isn't
// worth it anymore.

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}

export class ApiError extends Error {
  constructor(message: string, public code?: string, public status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null; reauthToken?: string | null } = {},
): Promise<T> {
  const { token, reauthToken, headers, body, ...rest } = options;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const res = await fetch(`/api/v1${path}`, {
    ...rest,
    body,
    headers: {
      ...(!isFormData && body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(reauthToken ? { 'x-reauth-token': reauthToken } : {}),
      ...headers,
    },
  });

  let json: ApiEnvelope<T> | null = null;
  try {
    json = await res.json();
  } catch {
    // No JSON body (e.g. empty response) — fall through to status check below.
  }

  if (!res.ok || !json?.success) {
    const message = json?.error?.message || `Request failed with status ${res.status}`;
    throw new ApiError(message, json?.error?.code, res.status);
  }

  return json.data as T;
}

export const apiClient = {
  get: <T>(path: string, token?: string | null, signal?: AbortSignal) => request<T>(path, { method: 'GET', token, signal }),
  post: <T>(path: string, body?: unknown, token?: string | null, reauthToken?: string | null, signal?: AbortSignal) =>
    request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined, token, reauthToken, signal }),
  patch: <T>(path: string, body?: unknown, token?: string | null, reauthToken?: string | null) =>
    request<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined, token, reauthToken }),
  put: <T>(path: string, body?: unknown, token?: string | null) =>
    request<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined, token }),
  del: <T>(path: string, token?: string | null, reauthToken?: string | null) => request<T>(path, { method: 'DELETE', token, reauthToken }),
  postForm: <T>(path: string, form: FormData, token?: string | null) =>
    request<T>(path, { method: 'POST', body: form, token }),
};
