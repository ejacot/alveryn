import { useEffect, useMemo, useState, type FormEvent } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getApiError } from "../api/api-errors";
import { forgotPassword, resetPassword, verifyPasswordResetCode } from "../api/endpoints";
import { AuthCard } from "../components/auth/auth-card";
import { AuthSubmitContent, PasswordVisibilityButton } from "../components/auth/auth-form-controls";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  resetPasswordSchema,
  type ResetPasswordValues
} from "../features/auth/auth-schemas";
import { useAuth } from "../features/auth/use-auth";
import { APP_HOME_PATH } from "../routes/app-paths";

export function ResetPasswordPage() {
  const { t } = useTranslation(["auth", "common"]);
  const navigate = useNavigate();
  const location = useLocation();
  const { completeEmailVerification: completePasswordReset } = useAuth();
  const email = useMemo(() => {
    const stateEmail = (location.state as { email?: string } | null)?.email;
    return stateEmail ?? window.sessionStorage.getItem("alveryn.passwordResetEmail") ?? "";
  }, [location.state]);
  const [step, setStep] = useState<"code" | "password">("code");
  const [message, setMessage] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email,
      code: "",
      newPassword: "",
      confirmPassword: ""
    }
  });

  useEffect(() => {
    if (!email) navigate("/forgot-password", { replace: true });
  }, [email, navigate]);

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = form.getValues("code");
    if (!/^\d{6}$/.test(code)) {
      form.setError("code", { message: t("auth:validation.codeLength") });
      return;
    }
    try {
      setMessage("");
      await verifyPasswordResetCode({ email, code });
      setStep("password");
    } catch (error) {
      setMessage(getApiError(error).message);
    }
  }

  async function onSubmit(values: ResetPasswordValues) {
    try {
      const result = await resetPassword(values);
      await completePasswordReset(result);
      window.sessionStorage.removeItem("alveryn.passwordResetEmail");
      navigate(APP_HOME_PATH, { replace: true });
    } catch (error) {
      const apiError = getApiError(error);
      if (apiError.fieldErrors.email) {
        form.setError("email", { message: apiError.fieldErrors.email });
      }
      if (apiError.fieldErrors.code) {
        form.setError("code", { message: apiError.fieldErrors.code });
      }
      if (apiError.fieldErrors.newPassword) {
        form.setError("newPassword", { message: apiError.fieldErrors.newPassword });
      }
      setMessage(!Object.keys(apiError.fieldErrors).length ? apiError.message : "");
    }
  }

  return (
    <AuthCard
      title={t(step === "code" ? "auth:resetPassword.codeTitle" : "auth:resetPassword.title")}
      subtitle={t(step === "code" ? "auth:resetPassword.codeSubtitle" : "auth:resetPassword.subtitle", { email })}
      footer={
        <span>
          {t("auth:resetPassword.footer")}{" "}
          <Link
            to="/forgot-password"
            className="text-white transition hover:text-white/70"
          >
            {t("auth:resetPassword.footerLink")}
          </Link>
        </span>
      }
      backLink={{ to: "/login", label: t("auth:resetPassword.backToLogin") }}
    >
      <form className="space-y-4" onSubmit={step === "code" ? verifyCode : form.handleSubmit(onSubmit)}>
        <input type="hidden" {...form.register("email")} />
        {step === "code" ? (
          <>
            <Input
              label={t("common:labels.verificationCode")}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="text-center text-xl tracking-[0.35em]"
              error={form.formState.errors.code?.message}
              {...form.register("code", {
                onChange: (event) => {
                  event.target.value = event.target.value.replace(/\D/g, "").slice(0, 6);
                }
              })}
            />
            <button
              type="button"
              className="w-full text-center text-sm text-white/52 transition hover:text-white"
              onClick={async () => {
                try {
                  const result = await forgotPassword(email);
                  setMessage(result.message);
                } catch (error) {
                  setMessage(getApiError(error).message);
                }
              }}
            >
              {t("auth:resetPassword.resend")}
            </button>
          </>
        ) : (
          <>
            <Input
              label={t("common:labels.newPassword")}
              type={passwordVisible ? "text" : "password"}
              autoComplete="new-password"
              error={form.formState.errors.newPassword?.message}
              helperText={t("auth:register.passwordHint")}
              endAdornment={<PasswordVisibilityButton visible={passwordVisible} onClick={() => setPasswordVisible((value) => !value)} />}
              {...form.register("newPassword")}
            />
            <Input
              label={t("auth:resetPassword.confirmPassword")}
              type={confirmVisible ? "text" : "password"}
              autoComplete="new-password"
              error={form.formState.errors.confirmPassword?.message}
              endAdornment={<PasswordVisibilityButton visible={confirmVisible} onClick={() => setConfirmVisible((value) => !value)} />}
              {...form.register("confirmPassword")}
            />
          </>
        )}
        {message ? <p className="text-sm text-white/54">{message}</p> : null}
        <Button className="auth-submit" type="submit" disabled={form.formState.isSubmitting} aria-busy={form.formState.isSubmitting}>
          <AuthSubmitContent
            loading={form.formState.isSubmitting}
            loadingLabel={t("auth:resetPassword.submitting")}
            label={t(step === "code" ? "auth:resetPassword.verifyCode" : "auth:resetPassword.submit")}
          />
        </Button>
      </form>
    </AuthCard>
  );
}
