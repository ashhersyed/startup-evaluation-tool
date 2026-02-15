import { useState, useCallback } from 'react';
import { subscribe } from '../lib/api';

const AUTH_KEY = 'job_search_auth';

function getStoredEmail(): string | null {
  try {
    return localStorage.getItem(AUTH_KEY);
  } catch {
    return null;
  }
}

export function useAuth() {
  const [email, setEmail] = useState<string | null>(getStoredEmail);

  const isAuthenticated = email !== null;

  const login = useCallback(async (newEmail: string) => {
    await subscribe(newEmail);
    localStorage.setItem(AUTH_KEY, newEmail);
    setEmail(newEmail);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY);
    setEmail(null);
  }, []);

  return { isAuthenticated, email, login, logout };
}
