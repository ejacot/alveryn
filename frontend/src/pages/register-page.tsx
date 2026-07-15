import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { getApiError } from "../api/api-errors";
import { AuthCard } from "../components/auth/auth-card";
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
  const { registerWithPassword } = useAuth();
  const [serverError, setServerError] = useState("");
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: ""
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
      footer={
        <span>
          {t("auth:register.footer")}{" "}
          <Link to="/login" className="text-white transition hover:text-white/70">
            {t("auth:register.footerLink")}
          </Link>
        </span>
      }
      backLink={{ to: "/login", label: t("auth:register.backToLogin") }}
    >
      <form className="space-y-3.5" onSubmit={form.handleSubmit(onSubmit)}>
        <Input
          label={t("common:labels.email")}
          type="email"
          error={form.formState.errors.email?.message}
          {...form.register("email")}
        />
        <Input
          label={t("common:labels.password")}
          type="password"
          error={form.formState.errors.password?.message}
          {...form.register("password")}
        />
        {serverError ? <p className="text-sm text-red-300">{serverError}</p> : null}
        <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t("auth:register.submitting") : t("auth:register.submit")}
        </Button>
      </form>
    </AuthCard>
  );
}
