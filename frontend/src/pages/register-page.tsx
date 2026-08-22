import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { getApiError } from "../api/api-errors";
import { AuthCard } from "../components/auth/auth-card";
import { AuthSubmitContent, PasswordVisibilityButton } from "../components/auth/auth-form-controls";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  registerSchema,
  type RegisterValues
} from "../features/auth/auth-schemas";
import { useAuth } from "../features/auth/use-auth";

const PENDING_VERIFICATION_EMAIL_KEY = "alveryn.pendingVerificationEmail";

export function RegisterPage() {
  const { t } = useTranslation(["auth", "common"]);
  const navigate = useNavigate();
  const location = useLocation();
  const { registerWithPassword } = useAuth();
  const [serverError, setServerError] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: new URLSearchParams(location.search).get("email") ?? "",
      password: "",
      confirmPassword: ""
    }
  });

  async function onSubmit(values: RegisterValues) {
    try {
      setServerError("");
      await registerWithPassword(values.email, values.password);
      window.sessionStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, values.email);
      navigate("/verify-email", {
        state: {
          email: values.email
        }
      });
    } catch (error) {
      const apiError = getApiError(error);
      setServerError(apiError.message);
      if (apiError.fieldErrors.email) {
        form.setError("email", { message: apiError.fieldErrors.email });
      }
      if (apiError.fieldErrors.password) {
        form.setError("password", { message: apiError.fieldErrors.password });
      }
    }
  }

  return (
    <AuthCard
      title={t("auth:register.title")}
      subtitle={t("auth:register.subtitle")}
      backLink={{ to: "/welcome", label: t("auth:login.backHome") }}
      footer={
        <span>
          {t("auth:register.footer")}{" "}
          <Link to="/login">
            {t("auth:register.footerLink")}
          </Link>
        </span>
      }
    >
      <form className="auth-form" onSubmit={form.handleSubmit(onSubmit)}>
        <Input
          label={t("common:labels.email")}
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder={t("auth:placeholders.email")}
          error={form.formState.errors.email?.message}
          {...form.register("email")}
        />
        <Input
          label={t("common:labels.password")}
          type={passwordVisible ? "text" : "password"}
          autoComplete="new-password"
          placeholder={t("auth:placeholders.password")}
          helperText={t("auth:register.passwordHint")}
          error={form.formState.errors.password?.message}
          endAdornment={
            <PasswordVisibilityButton visible={passwordVisible} onClick={() => setPasswordVisible((visible) => !visible)} />
          }
          {...form.register("password")}
        />
        <Input
          label={t("auth:register.confirmPassword")}
          type={confirmVisible ? "text" : "password"}
          autoComplete="new-password"
          placeholder={t("auth:placeholders.confirmPassword")}
          error={form.formState.errors.confirmPassword?.message}
          endAdornment={<PasswordVisibilityButton visible={confirmVisible} onClick={() => setConfirmVisible((visible) => !visible)} />}
          {...form.register("confirmPassword")}
        />
        {serverError ? <div className="auth-form-error" role="alert" aria-live="assertive">{serverError}</div> : null}
        <Button className="auth-submit" type="submit" disabled={form.formState.isSubmitting} aria-busy={form.formState.isSubmitting}>
          <AuthSubmitContent loading={form.formState.isSubmitting} loadingLabel={t("auth:register.submitting")} label={t("auth:register.submit")} />
        </Button>
      </form>
    </AuthCard>
  );
}
