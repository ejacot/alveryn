import { createContext } from "react";
import type { CurrentUser } from "../../types/auth";

type AuthContextValue = {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  isHydrating: boolean;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  registerWithPassword: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
