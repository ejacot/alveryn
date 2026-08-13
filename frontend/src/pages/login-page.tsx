import { useState } from "react";
import { useEffect, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthCard } from "../components/auth/auth-card";
import { AuthSubmitContent, PasswordVisibilityButton } from "../components/auth/auth-form-controls";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  loginSchema,
  type LoginValues
} from "../features/auth/auth-schemas";
import { useAuth } from "../features/auth/use-auth";
import { APP_HOME_PATH } from "../routes/app-paths";

export function LoginPage() {
  const { t } = useTranslation(["auth", "common"]);
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithPassword } = useAuth();
  const [serverError, setServerError] = useState(
    new URLSearchParams(location.search).get("oauth") === "error"
      ? t("auth:oauth.startError")
      : ((location.state as { message?: string } | null)?.message ?? "")
  );
  const [passwordVisible, setPasswordVisible] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  });
  const password = form.watch("password");

  useEffect(() => {
    if (serverError) errorRef.current?.focus();
  }, [serverError]);

  async function onSubmit(values: LoginValues) {
    try {
      setServerError("");
      await loginWithPassword(values.email, values.password);
      const next = (location.state as { from?: { pathname?: string } } | null)
        ?.from?.pathname;
      navigate(next ?? APP_HOME_PATH, { replace: true });
    } catch {
      setServerError(t("auth:login.authenticationError"));
    }
  }

  return (
    <AuthCard
      title={t("auth:login.title")}
      subtitle={t("auth:login.subtitle")}
      backLink={{
        to: "/welcome",
        label: t("auth:login.backHome")
      }}
      footer={
        <span>
          {t("auth:login.footer")}{" "}
          <Link to="/register">
            {t("auth:login.footerLink")}
          </Link>
        </span>
      }
    >
      <form className="auth-form" aria-describedby={serverError ? "login-auth-error" : undefined} onSubmit={form.handleSubmit(onSubmit)}>
        <Input
          label={t("common:labels.email")}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={t("auth:placeholders.email")}
          error={form.formState.errors.email?.message}
          {...form.register("email")}
        />
        <Input
          label={t("common:labels.password")}
          type={passwordVisible ? "text" : "password"}
          autoComplete="current-password"
          placeholder={t("auth:placeholders.password")}
          error={form.formState.errors.password?.message}
          endAdornment={password ? (
            <PasswordVisibilityButton visible={passwordVisible} onClick={() => setPasswordVisible((visible) => !visible)} />
          ) : (
            <Link
              to="/forgot-password"
              className="auth-forgot-link"
            >
              {t("auth:login.forgotPassword")}
            </Link>
          )}
          {...form.register("password")}
        />
        {serverError ? (
          <div id="login-auth-error" ref={errorRef} tabIndex={-1} className="auth-form-error" role="alert" aria-live="assertive">{serverError}</div>
        ) : null}
        <Button className="auth-submit" type="submit" disabled={form.formState.isSubmitting} aria-busy={form.formState.isSubmitting}>
          <AuthSubmitContent loading={form.formState.isSubmitting} loadingLabel={t("auth:login.submitting")} label={t("auth:login.submit")} />
        </Button>
      </form>
    </AuthCard>
  );
}
