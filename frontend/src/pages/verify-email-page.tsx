import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { getApiError } from "../api/api-errors";
import { resendVerification, verifyEmail } from "../api/endpoints";
import { AuthCard } from "../components/auth/auth-card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  verifyEmailSchema,
  type VerifyEmailValues
} from "../features/auth/auth-schemas";
import { useAuth } from "../features/auth/use-auth";

const PENDING_VERIFICATION_EMAIL_KEY = "alveryn.pendingVerificationEmail";
const RESEND_COOLDOWN_SECONDS = 60;

export function VerifyEmailPage() {
  const { t } = useTranslation(["auth", "common"]);
  const location = useLocation();
  const navigate = useNavigate();
  const { completeEmailVerification } = useAuth();
  const [message, setMessage] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const defaultEmail = useMemo(
    () =>
      ((location.state as { email?: string } | null)?.email ??
        window.sessionStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY) ??
        ""),
    [location.state]
  );

  const form = useForm<VerifyEmailValues>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: {
      email: defaultEmail,
      code: ""
    }
  });

  async function onSubmit(values: VerifyEmailValues) {
    try {
      const result = await verifyEmail(values);
      await completeEmailVerification(result);
      window.sessionStorage.removeItem(PENDING_VERIFICATION_EMAIL_KEY);
      navigate("/onboarding", { replace: true });
    } catch (error) {
      const apiError = getApiError(error);
      if (apiError.fieldErrors.email) {
        form.setError("email", { message: apiError.fieldErrors.email });
      }
      if (apiError.fieldErrors.code) {
        form.setError("code", { message: apiError.fieldErrors.code });
      }
      setMessage(apiError.message);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) {
      return;
    }
    const email = form.getValues("email");
    if (!email) {
      setMessage(t("auth:verifyEmail.missingEmail"));
      return;
    }
    try {
      const result = await resendVerification(email);
      setMessage(result.message);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      setMessage(getApiError(error).message);
    }
  }

  useEffect(() => {
    if (resendCooldown <= 0) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [resendCooldown]);

  return (
    <AuthCard
      title={t("auth:verifyEmail.title")}
      backLink={{ to: "/login", label: t("auth:verifyEmail.backToLogin") }}
    >
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit(onSubmit, (errors) => {
          if (errors.email) {
            setMessage(t("auth:verifyEmail.missingEmail"));
          }
        })}
      >
        <input type="hidden" {...form.register("email")} />
        <Input
          label={t("common:labels.verificationCode")}
          inputMode="numeric"
          autoComplete="one-time-code"
          error={form.formState.errors.code?.message}
          {...form.register("code")}
        />
        {message ? <p className="text-sm text-white/54">{message}</p> : null}
        <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t("auth:verifyEmail.submitting") : t("auth:verifyEmail.submit")}
        </Button>
        <Button
          className="w-full"
          variant="secondary"
          type="button"
          onClick={() => void handleResend()}
          disabled={resendCooldown > 0}
        >
          {t("auth:verifyEmail.resend")}
        </Button>
        {resendCooldown > 0 ? (
          <p className="text-center text-xs text-white/42">
            {t("auth:verifyEmail.resendCooldown", { seconds: resendCooldown })}
          </p>
        ) : null}
      </form>
    </AuthCard>
  );
}
