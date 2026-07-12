import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getCurrentUser, login, logout, register } from "../../api/endpoints";
import {
  clearTokens,
  getStoredAccessToken,
  getStoredRefreshToken,
  storeTokens
} from "../../api/auth-storage";
import { AuthContext } from "./auth-context";
import type { CurrentUser } from "../../types/auth";

type Props = {
  children: React.ReactNode;
};

export function AuthProvider({ children }: Props) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const queryClient = useQueryClient();

  async function refreshCurrentUser() {
    const nextUser = await getCurrentUser();
    setUser(nextUser);
  }

  async function loginWithPassword(email: string, password: string) {
    const result = await login({ email, password });
    storeTokens(result.accessToken, result.refreshToken);
    await refreshCurrentUser();
  }

  async function registerWithPassword(email: string, password: string) {
    await register({ email, password });
  }

  async function signOut() {
    const refreshToken = getStoredRefreshToken();

    try {
      if (refreshToken) {
        await logout(refreshToken);
      }
    } finally {
      clearTokens();
      queryClient.clear();
      setUser(null);
    }
  }

  useEffect(() => {
    async function hydrate() {
      try {
        if (getStoredAccessToken()) {
          await refreshCurrentUser();
        }
      } catch {
        clearTokens();
        setUser(null);
      } finally {
        setIsHydrating(false);
      }
    }

    void hydrate();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isHydrating,
        loginWithPassword,
        registerWithPassword,
        logout: signOut,
        refreshCurrentUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
