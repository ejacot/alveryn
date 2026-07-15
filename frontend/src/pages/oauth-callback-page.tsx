import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { getApiError } from "../api/api-errors";
import { AuthCard } from "../components/auth/auth-card";
import { Button } from "../components/ui/button";
import { useAuth } from "../features/auth/use-auth";
import { APP_HOME_PATH } from "../routes/app-paths";

export function OAuthCallbackPage() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const { completeOAuthLogin } = useAuth();
  const [error, setError] = useState("");
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let active = true;

    async function finishLogin() {
      try {
        const user = await completeOAuthLogin();
        if (!active) return;
        navigate(user.preferences?.onboardingCompleted ? APP_HOME_PATH : "/onboarding", { replace: true });
      } catch (caught) {
        if (!active) return;
        const apiError = getApiError(caught);
        setError(apiError.message || t("oauth.finishError"));
      }
    }

    void finishLogin();

    return () => {
      active = false;
    };
  }, [completeOAuthLogin, navigate, t]);

  return (
    <AuthCard title={t("oauth.finishingTitle")} subtitle={t("oauth.finishingSubtitle")}>
      {error ? (
        <div className="space-y-4">
          <p className="text-sm text-red-300">{error}</p>
          <Button type="button" className="w-full" onClick={() => navigate("/login", { replace: true })}>
            {t("oauth.backToLogin")}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-white/58">{t("oauth.finishing")}</p>
      )}
    </AuthCard>
  );
}
