const TOKEN_KEY = "veyra_access_token";
const REFRESH_KEY = "veyra_refresh_token";
const SESSION_KEY = "veyra_chat_session_id";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(REFRESH_KEY);
}

export function setStoredTokens(accessToken: string, refreshToken: string) {
  window.localStorage.setItem(TOKEN_KEY, accessToken);
  window.localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function setStoredToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}

export function getStoredSessionId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(SESSION_KEY);
}

export function setStoredSessionId(sessionId: string) {
  window.localStorage.setItem(SESSION_KEY, sessionId);
}

export function clearStoredSessionId() {
  window.localStorage.removeItem(SESSION_KEY);
}