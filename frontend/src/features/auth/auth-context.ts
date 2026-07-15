import { createContext } from "react";
import type { AuthTokens, CurrentUser } from "../../types/auth";

export type AuthContextValue = {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  isHydrating: boolean;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  registerWithPassword: (email: string, password: string) => Promise<void>;
  completeEmailVerification: (tokens: AuthTokens) => Promise<CurrentUser>;
  completeOAuthLogin: () => Promise<CurrentUser>;
  logout: () => Promise<void>;
  refreshCurrentUser: () => Promise<CurrentUser>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
