const API_PATH_PREFIX = '/api/';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_COOKIE_NAME = 'XSRF-TOKEN';

function getCookieValue(name: string): string | null {
  const cookieEntry = document.cookie
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.toLowerCase().startsWith(`${name.toLowerCase()}=`));

  if (!cookieEntry) {
    return null;
  }

  return decodeURIComponent(cookieEntry.split('=').slice(1).join('='));
}

function shouldIntercept(url: string) {
  return url.startsWith(API_PATH_PREFIX) || url.startsWith(`${window.location.origin}${API_PATH_PREFIX}`);
}

export function initFetchInterceptor() {
  if (typeof window === 'undefined') return;
  const globalAny = window as any;
  if (globalAny.__COBITUN_FETCH_INTERCEPTOR_INSTALLED__) return;
  globalAny.__COBITUN_FETCH_INTERCEPTOR_INSTALLED__ = true;

  const originalFetch = window.fetch.bind(window) as Window['fetch'];

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const inputForRequest: RequestInfo = input instanceof Request ? input : input instanceof URL ? input.toString() : input;
    const request = new Request(inputForRequest, init);
    const url = request.url;
    const isApiCall = shouldIntercept(url);

    if (!isApiCall) {
      return originalFetch(request);
    }

    const headers = new Headers(request.headers);
    const credentials = init?.credentials || request.credentials || 'include';

    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase())) {
      const csrfToken = getCookieValue(CSRF_COOKIE_NAME);
      if (csrfToken) {
        headers.set(CSRF_HEADER_NAME, csrfToken);
      }
    }

    const modifiedRequest = new Request(request, {
      headers,
      credentials,
    });

    return originalFetch(modifiedRequest);
  }) as unknown as Window['fetch'];
}

