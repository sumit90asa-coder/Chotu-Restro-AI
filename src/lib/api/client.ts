function resolveApiBaseUrl(raw: string | undefined): string {
  let url = raw?.trim();
  if (url && url.includes("chotu-backend-jknt")) {
    url = url.replace("chotu-backend-jknt", "chotu-backend-o8wn");
  }
  if (!url) {
    if (typeof window !== "undefined" && window.location.hostname.includes("onrender.com")) {
      url = "https://chotu-backend-o8wn.onrender.com/api/v1";
    } else {
      url = "http://127.0.0.1:8000/api/v1";
    }
  }
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    if (url.includes("onrender.com")) {
      url = `https://${url}`;
    } else if (url.includes("chotu-backend") || url.includes("backend")) {
      url = `https://${url}.onrender.com`;
    } else if (url.includes("127.0.0.1") || url.includes("localhost")) {
      url = `http://${url}`;
    } else {
      url = `https://${url}`;
    }
  }
  const clean = url.replace(/\/+$/, "");
  return clean.endsWith("/api/v1") ? clean : `${clean}/api/v1`;
}

function resolveWsBaseUrl(rawWs: string | undefined, apiBase: string): string {
  if (rawWs) {
    let ws = rawWs.trim();
    if (!ws.startsWith("ws://") && !ws.startsWith("wss://")) {
      ws = ws.replace(/^http/i, "ws");
      if (!ws.startsWith("ws://") && !ws.startsWith("wss://")) {
        ws = `wss://${ws}`;
      }
    }
    return ws.replace(/\/+$/, "");
  }
  return apiBase.replace(/^http/i, "ws").replace(/\/api\/v1\/?$/, "");
}

export const API_BASE_URL = resolveApiBaseUrl(process.env.NEXT_PUBLIC_API_URL);
export const WS_BASE_URL = resolveWsBaseUrl(process.env.NEXT_PUBLIC_WS_URL, API_BASE_URL);

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      localStorage.setItem("chotu_auth_token", token);
      document.cookie = `chotu_auth_token=${encodeURIComponent(token)}; path=/; max-age=86400; SameSite=Lax`;
    } else {
      localStorage.removeItem("chotu_auth_token");
      document.cookie = "chotu_auth_token=; path=/; max-age=0; SameSite=Lax";
    }
  }
}

export function getAuthToken(): string | null {
  if (authToken) return authToken;
  if (typeof window !== "undefined") {
    return localStorage.getItem("chotu_auth_token");
  }
  return null;
}

export interface ApiErrorResponse {
  detail?: string | Array<{ msg?: string; loc?: string[] }>;
  message?: string;
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  
  const token = getAuthToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status} ${response.statusText}`;
    try {
      const errData = await response.json();
      if (typeof errData.detail === "string") {
        errorMessage = errData.detail;
      } else if (Array.isArray(errData.detail) && errData.detail.length > 0) {
        errorMessage = errData.detail[0].msg || JSON.stringify(errData.detail);
      } else if (errData.message) {
        errorMessage = errData.message;
      }
    } catch {
      // Body is not json
    }

    // Global session expiration / invalid token handler
    if (response.status === 401 && typeof window !== "undefined") {
      setAuthToken(null);
      localStorage.removeItem("chotu_auth_token");
      localStorage.removeItem("chotu_user_session");
      document.cookie = "chotu_auth_token=; path=/; max-age=0; SameSite=Lax";
      
      const currentPath = window.location.pathname;
      const isPublicRoute =
        currentPath === "/" ||
        currentPath === "/landing" ||
        currentPath.startsWith("/login") ||
        currentPath.startsWith("/register") ||
        currentPath.startsWith("/qr/");
        
      if (!isPublicRoute) {
        window.location.href = `/login?from=${encodeURIComponent(currentPath)}&reason=session_expired`;
      }
    }

    throw new Error(errorMessage);
  }

  // Handle empty 204 or non-json responses
  if (response.status === 204) {
    return {} as T;
  }

  const data = await response.json();
  return data as T;
}
