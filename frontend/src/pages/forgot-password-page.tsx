import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { getApiError } from "../api/api-errors";
import { forgotPassword } from "../api/endpoints";
import { AuthCard } from "../components/auth/auth-card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  forgotPasswordSchema,
  type ForgotPasswordValues
} from "../features/auth/auth-schemas";

export function ForgotPasswordPage() {
  const { t } = useTranslation(["auth", "common"]);
  const [message, setMessage] = useState("");
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" }
  });

  async function onSubmit(values: ForgotPasswordValues) {
    try {
      const result = await forgotPassword(values.email);
      setMessage(result.message);
    } catch (error) {
      const apiError = getApiError(error);
      setMessage(apiError.message);
      if (apiError.fieldErrors.email) {
        form.setError("email", { message: apiError.fieldErrors.email });
      }
    }
  }

  return (
    <AuthCard
      title={t("auth:forgotPassword.title")}
      subtitle={t("auth:forgotPassword.subtitle")}
      footer={
        <span>
          {t("auth:forgotPassword.footer")}{" "}
          <Link to="/login" className="text-white transition hover:text-white/70">
            {t("auth:forgotPassword.footerLink")}
          </Link>
        </span>
      }
      backLink={{ to: "/login", label: t("auth:forgotPassword.backToLogin") }}
    >
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <Input
          label={t("common:labels.email")}
          type="email"
          error={form.formState.errors.email?.message}
          {...form.register("email")}
        />
        {message ? <p className="text-sm text-white/54">{message}</p> : null}
        <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t("auth:forgotPassword.submitting") : t("auth:forgotPassword.submit")}
        </Button>
      </form>
    </AuthCard>
  );
}
