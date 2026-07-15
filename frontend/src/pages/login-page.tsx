import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getApiError } from "../api/api-errors";
import { AuthCard } from "../components/auth/auth-card";
import { GoogleAuthButton } from "../components/auth/google-auth-button";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  loginSchema,
  type LoginValues
} from "../features/auth/auth-schemas";
import { useAuth } from "../features/auth/use-auth";

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
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  });

  async function onSubmit(values: LoginValues) {
    try {
      setServerError("");
      await loginWithPassword(values.email, values.password);
      const next = (location.state as { from?: { pathname?: string } } | null)
        ?.from?.pathname;
      navigate(next ?? "/", { replace: true });
    } catch (error) {
      const apiError = getApiError(error);
      setServerError(apiError.message);
    }
  }

  return (
    <AuthCard
      title={t("auth:login.title")}
      footer={
        <span>
          {t("auth:login.footer")}{" "}
          <Link to="/register" className="text-white transition hover:text-white/70">
            {t("auth:login.footerLink")}
          </Link>
        </span>
      }
    >
      <form className="space-y-3.5" onSubmit={form.handleSubmit(onSubmit)}>
        <Input
          label={t("common:labels.email")}
          type="email"
          autoComplete="email"
          error={form.formState.errors.email?.message}
          {...form.register("email")}
        />
        <Input
          label={t("common:labels.password")}
          type="password"
          autoComplete="current-password"
          error={form.formState.errors.password?.message}
          {...form.register("password")}
        />
        {serverError ? (
          <p className="text-sm text-red-300">{serverError}</p>
        ) : null}
        <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t("auth:login.submitting") : t("auth:login.submit")}
        </Button>
        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-sm text-white/52 transition hover:text-white/74"
          >
            {t("auth:login.forgotPassword")}
          </Link>
        </div>
        <div className="pt-2.5">
          <div className="mb-3 flex items-center gap-3 text-[0.64rem] uppercase tracking-[0.22em] text-white/20">
            <span className="h-px flex-1 bg-white/10" />
            {t("auth:oauth.or")}
            <span className="h-px flex-1 bg-white/10" />
          </div>
          <GoogleAuthButton />
        </div>
      </form>
    </AuthCard>
  );
}
