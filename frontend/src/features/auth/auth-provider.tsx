import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getCurrentUser, login, logout, refreshSession, register } from "../../api/endpoints";
import { queryKeys } from "../../api/query-keys";
import {
  clearTokens,
  hasStoredSession,
  storeSession,
  subscribeToAuthStorage
} from "../../api/auth-storage";
import { applyAppLanguage } from "../../i18n";
import { setAuthFailureHandler } from "../../api/http";
import { AuthContext } from "./auth-context";
import type { AuthTokens, CurrentUser } from "../../types/auth";
import { applyAppTheme } from "../../utils/theme";

type Props = {
  children: React.ReactNode;
};

export function AuthProvider({ children }: Props) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isHydrating, setIsHydrating] = useState(() => hasStoredSession());
  const queryClient = useQueryClient();

  const refreshCurrentUser = useCallback(async () => {
    const nextUser = await getCurrentUser();
    queryClient.setQueryData(queryKeys.currentUser(), nextUser);
    queryClient.setQueryData(queryKeys.profile(), nextUser.profile);
    queryClient.setQueryData(queryKeys.preferences(), nextUser.preferences);
    applyAppLanguage(nextUser.preferences?.language);
    applyAppTheme(nextUser.preferences?.theme);
    setUser(nextUser);
    return nextUser;
  }, [queryClient]);

  async function loginWithPassword(email: string, password: string) {
    const result = await login({ email, password });
    storeSession(result.accessToken);
    await refreshCurrentUser();
  }

  async function registerWithPassword(email: string, password: string) {
    await register({ email, password });
  }

  async function completeEmailVerification(tokens: AuthTokens) {
    storeSession(tokens.accessToken);
    return refreshCurrentUser();
  }

  async function completeOAuthLogin() {
    const result = await refreshSession();
    storeSession(result.accessToken);
    return refreshCurrentUser();
  }

  async function signOut() {
    try {
      if (hasStoredSession()) {
        await logout();
      }
    } finally {
      clearTokens();
      queryClient.clear();
      setUser(null);
      applyAppTheme("SYSTEM");
    }
  }

  useEffect(() => {
    setAuthFailureHandler(() => {
      queryClient.clear();
      setUser(null);
      applyAppTheme("SYSTEM");
    });

    async function hydrate() {
      try {
        if (hasStoredSession()) {
          await refreshCurrentUser();
        }
      } catch {
        clearTokens();
        setUser(null);
        applyAppTheme("SYSTEM");
      } finally {
        setIsHydrating(false);
      }
    }

    void hydrate();

    const unsubscribe = subscribeToAuthStorage(() => {
      if (!hasStoredSession()) {
        queryClient.clear();
        setUser(null);
        applyAppTheme("SYSTEM");
        setIsHydrating(false);
        return;
      }

      setIsHydrating(true);
      void refreshCurrentUser()
        .catch(() => {
          clearTokens();
          queryClient.clear();
          setUser(null);
          applyAppTheme("SYSTEM");
        })
        .finally(() => {
          setIsHydrating(false);
        });
    });

    return () => {
      unsubscribe();
      setAuthFailureHandler(null);
    };
  }, [queryClient, refreshCurrentUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isHydrating,
        loginWithPassword,
        registerWithPassword,
        completeEmailVerification,
        completeOAuthLogin,
        logout: signOut,
        refreshCurrentUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
