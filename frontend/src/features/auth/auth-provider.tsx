import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getCurrentUser, login, logout, refreshSession, register } from "../../api/endpoints";
import { queryKeys } from "../../api/query-keys";
import {
  clearTokens,
  getStoredAccessToken,
  hasStoredSession,
  setStoredAccessToken,
  storeSession,
  subscribeToAuthStorage
} from "../../api/auth-storage";
import { applyAppLanguage } from "../../i18n";
import { setAuthFailureHandler } from "../../api/http";
import { AuthContext } from "./auth-context";
import type { AuthTokens, CurrentUser } from "../../types/auth";
import { applyAppTheme } from "../../utils/theme";
import { clearInitialSetupDraft } from "../onboarding/onboarding-storage";

type Props = {
  children: React.ReactNode;
};

let sessionRestorePromise: Promise<void> | null = null;

export function AuthProvider({ children }: Props) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
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

  const ensureSessionReady = useCallback(async () => {
    if (!hasStoredSession()) {
      return;
    }
    if (!getStoredAccessToken()) {
      sessionRestorePromise ??= refreshSession()
        .then((result) => {
          setStoredAccessToken(result.accessToken);
        })
        .finally(() => {
          sessionRestorePromise = null;
        });
      await sessionRestorePromise;
    }
  }, []);

  async function loginWithPassword(email: string, password: string) {
    const result = await login({ email, password });
    storeSession(result.accessToken);
    return refreshCurrentUser();
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
      if (user?.account.id) clearInitialSetupDraft(user.account.id);
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
      if (!hasStoredSession()) {
        setUser(null);
        setIsHydrating(false);
        return;
      }

      try {
        await ensureSessionReady();
        await refreshCurrentUser();
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
      void ensureSessionReady()
        .then(refreshCurrentUser)
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
  }, [ensureSessionReady, queryClient, refreshCurrentUser]);

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
