import { create } from 'zustand';

type Persisted = { token: string | null; email: string | null };

type AdminAuthState = Persisted & {
  login: (token: string, email: string) => void;
  logout: () => void;
};

const STORAGE_KEY = 'lasanharia-admin-auth';

function loadInitial(): Persisted {
  if (typeof window === 'undefined') return { token: null, email: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, email: null };
    return JSON.parse(raw) as Persisted;
  } catch {
    return { token: null, email: null };
  }
}

export const useAdminAuth = create<AdminAuthState>((set) => ({
  ...loadInitial(),
  login: (token, email) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, email }));
    set({ token, email });
  },
  logout: () => {
    window.localStorage.removeItem(STORAGE_KEY);
    set({ token: null, email: null });
  },
}));
