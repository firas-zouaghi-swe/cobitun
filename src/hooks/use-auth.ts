import { useCallback } from 'react';
import { useAppStore } from '@/lib/store';

export const Roles = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  CUSTOMER: 'CUSTOMER',
} as const;

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookieEntry = document.cookie
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.toLowerCase().startsWith(`${name.toLowerCase()}=`));
  if (!cookieEntry) return null;
  return decodeURIComponent(cookieEntry.split('=').slice(1).join('='));
}

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const csrfToken = getCookieValue('XSRF-TOKEN');
  if (csrfToken) {
    headers['x-csrf-token'] = csrfToken;
  }

  if (process.env.NODE_ENV !== 'production') {
    const user = useAppStore.getState().user;
    if (user) {
      headers['x-user-id'] = String(user.id);
      headers['x-user-role'] = user.role;
    }
  }

  return headers;
}

function normalizeHeaders(headersInit?: HeadersInit | null): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!headersInit) return headers;

  if (headersInit instanceof Headers) {
    headersInit.forEach((value, key) => {
      headers[key] = value;
    });
  } else if (Array.isArray(headersInit)) {
    headersInit.forEach(([key, value]) => {
      headers[key] = value;
    });
  } else {
    Object.assign(headers, headersInit);
  }

  return headers;
}

function cloneBody(body: BodyInit | null | undefined): BodyInit | null | undefined {
  if (!body) return body;

  if (body instanceof FormData) {
    const cloned = new FormData();
    for (const [key, value] of body.entries()) {
      if (value instanceof File) {
        cloned.append(key, value, value.name);
      } else {
        cloned.append(key, value as string);
      }
    }
    return cloned;
  }

  if (body instanceof URLSearchParams) {
    return new URLSearchParams(body.toString());
  }

  if (body instanceof Blob) {
    return body.slice(0, body.size, body.type);
  }

  if (typeof body === 'string') {
    return body;
  }

  if (body instanceof ArrayBuffer) {
    return body.slice(0);
  }

  if (ArrayBuffer.isView(body)) {
    return body.buffer.slice(0);
  }

  return body;
}

export async function fetchWithAuth(input: RequestInfo, init?: RequestInit) {
  const originalHeaders = normalizeHeaders(init?.headers ?? null);
  const headers = { ...getAuthHeaders(), ...originalHeaders };
  const fetchOptions: RequestInit = {
    ...init,
    headers,
    credentials: 'include',
  };

  try {
    let response = await fetch(input, fetchOptions);
    if (response.status === 401) {
      const refreshUrl = `${window.location.origin}/api/auth/refresh`;
      const refreshResponse = await fetch(refreshUrl, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      });

      if (refreshResponse.ok) {
        const retryOptions: RequestInit = {
          ...fetchOptions,
          body: cloneBody(fetchOptions.body),
        };
        response = await fetch(input, retryOptions);
      } else {
        const refreshText = await refreshResponse.text().catch(() => '');
        useAppStore.getState().logout();
      }
    }

    if (response.status === 401) {
      useAppStore.getState().logout();
    }

    return response;
  } catch (error) {
    throw error;
  }
}

export function useAuth() {
  const user = useAppStore((s) => s.user);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const login = useAppStore((s) => s.login);
  const logout = useAppStore((s) => s.logout);
  return { user, isAuthenticated, login, logout } as const;
}

export function usePermission() {
  const user = useAppStore((s) => s.user);
  const hasRole = useCallback((role: string) => !!user && user.role === role, [user]);
  const isAdmin = useCallback(
    () => !!user && (user.role === Roles.ADMIN || user.role === Roles.SUPER_ADMIN),
    [user]
  );
  const isOwner = useCallback((ownerId?: number | null) => !!user && ownerId != null && user.id === ownerId, [user]);
  return { hasRole, isAdmin, isOwner } as const;
}

export default useAuth;

