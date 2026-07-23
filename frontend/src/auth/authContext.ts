/**
 * Назначение: контекст автентификации.
 */

import { createContext } from 'react';

export type AuthUser = {
  sub: string;
  email?: string;
};

export type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAuthRequired: boolean;
  loginWithToken: (token: string) => void;
  logout: () => void | Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
