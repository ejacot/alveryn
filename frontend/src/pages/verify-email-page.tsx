import { Check, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getApiError } from "../api/api-errors";
import { resendVerification, verifyEmail } from "../api/endpoints";
import { AuthCard } from "../components/auth/auth-card";
import { Input } from "../components/ui/input";
import {
  verifyEmailSchema,
  type VerifyEmailValues
} from "../features/auth/auth-schemas";
import { useAuth } from "../features/auth/use-auth";

const PENDING_VERIFICATION_EMAIL_KEY = "alveryn.pendingVerificationEmail";
const RESEND_COOLDOWN_SECONDS = 60;
const SUCCESS_TRANSITION_MS = 700;

type Feedback = { kind: "error" | "success"; text: string } | null;

export function VerifyEmailPage() {
  const { t } = useTranslation(["auth", "common"]);
  const location = useLocation();
  const navigate = useNavigate();
  const { completeEmailVerification } = useAuth();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const successRef = useRef<HTMLElement>(null);
  const defaultEmail = useMemo(
    () =>
      ((location.state as { email?: string } | null)?.email ??
        window.sessionStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY) ??
        ""),
    [location.state]
  );

  const form = useForm<VerifyEmailValues>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { email: defaultEmail, code: "" }
  });

  useEffect(() => {
    if (!isVerified) return undefined;
    successRef.current?.focus();
    const timeoutId = window.setTimeout(() => {
      navigate("/onboarding", { replace: true });
    }, SUCCESS_TRANSITION_MS);
    return () => window.clearTimeout(timeoutId);
  }, [isVerified, navigate]);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const intervalId = window.setInterval(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [resendCooldown]);

  async function onSubmit(values: VerifyEmailValues) {
    setFeedback(null);
    form.clearErrors("code");
    try {
      const result = await verifyEmail(values);
      await completeEmailVerification(result);
      window.sessionStorage.removeItem(PENDING_VERIFICATION_EMAIL_KEY);
      setIsVerified(true);
    } catch (error) {
      const apiError = getApiError(error);
      const normalized = apiError.message.toLowerCase();
      const text =
        normalized.includes("expired")
          ? t("auth:verifyEmail.expiredCode")
          : apiError.isAuthError || normalized.includes("invalid verification code")
            ? t("auth:verifyEmail.invalidCode")
            : t("auth:verifyEmail.networkError");
      form.setError("code", { message: text });
      setFeedback({ kind: "error", text });
    }
  }

  async function handleResend() {
    if (isResending || resendCooldown > 0 || !defaultEmail) return;
    setFeedback(null);
    setIsResending(true);
    try {
      await resendVerification(defaultEmail);
      setFeedback({ kind: "success", text: t("auth:verifyEmail.resendSuccess") });
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setFeedback({ kind: "error", text: t("auth:verifyEmail.networkError") });
    } finally {
      setIsResending(false);
    }
  }

  function useDifferentEmail() {
    window.sessionStorage.removeItem(PENDING_VERIFICATION_EMAIL_KEY);
  }

  if (isVerified) {
    return (
      <main className="auth-shell verify-success-transition">
        <section
          ref={successRef}
          className="verify-email-success"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          tabIndex={-1}
        >
          <span><Check aria-hidden="true" /></span>
          <h1>{t("auth:verifyEmail.success")}</h1>
          <p>{t("auth:verifyEmail.preparing")}</p>
        </section>
      </main>
    );
  }

  if (!defaultEmail) {
    return (
      <AuthCard
        title={t("auth:verifyEmail.title")}
        subtitle={t("auth:verifyEmail.missingEmail")}
      >
        <div className="auth-form verify-email-form">
          <div className="auth-form-error" role="alert">
            {t("auth:verifyEmail.missingEmail")}
          </div>
          <Link to="/login" className="auth-submit verify-email-return">
            {t("auth:verifyEmail.returnToSignIn")}
          </Link>
        </div>
      </AuthCard>
    );
  }

  const codeError = form.formState.errors.code?.message;
  const codeRegistration = form.register("code", {
    onChange: (event) => {
      event.target.value = event.target.value.replace(/\D/g, "").slice(0, 6);
      if (feedback?.kind === "error") setFeedback(null);
    }
  });
  return (
    <AuthCard
      title={t("auth:verifyEmail.title")}
      subtitle={t("auth:verifyEmail.description", { email: defaultEmail })}
      footer={
        <Link to="/register" onClick={useDifferentEmail}>
          {t("auth:verifyEmail.useDifferentEmail")}
        </Link>
      }
    >
      <form className="auth-form verify-email-form" onSubmit={form.handleSubmit(onSubmit)}>
        <input type="hidden" {...form.register("email")} />
        <Input
          label={t("common:labels.verificationCode")}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder={t("auth:verifyEmail.placeholder")}
          error={codeError}
          {...codeRegistration}
          onPaste={(event) => {
            event.preventDefault();
            const code = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
            form.setValue("code", code, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
          }}
        />

        {feedback?.kind === "success" ? (
          <div className="verify-email-status" role="status" aria-live="polite">
            <Check aria-hidden="true" />{feedback.text}
          </div>
        ) : feedback?.kind === "error" && codeError ? (
          <div className="sr-only" role="alert" aria-live="assertive">{feedback.text}</div>
        ) : feedback?.kind === "error" && !codeError ? (
          <div className="auth-form-error" role="alert">{feedback.text}</div>
        ) : null}

        <button
          type="submit"
          className="auth-submit"
          disabled={form.formState.isSubmitting}
          aria-busy={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? (
            <><LoaderCircle className="auth-spinner" aria-hidden="true" />{t("auth:verifyEmail.submitting")}</>
          ) : t("auth:verifyEmail.submit")}
        </button>
        <button
          type="button"
          className="verify-email-resend"
          onClick={() => void handleResend()}
          disabled={isResending || resendCooldown > 0}
          aria-busy={isResending}
        >
          {isResending ? (
            <><LoaderCircle className="auth-spinner" aria-hidden="true" />{t("auth:verifyEmail.resending")}</>
          ) : resendCooldown > 0
            ? t("auth:verifyEmail.resendCooldown", { seconds: resendCooldown })
            : t("auth:verifyEmail.resend")}
        </button>
      </form>
    </AuthCard>
  );
}
