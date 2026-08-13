import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { getApiError } from "../api/api-errors";
import { forgotPassword } from "../api/endpoints";
import { AuthCard } from "../components/auth/auth-card";
import { AuthSubmitContent } from "../components/auth/auth-form-controls";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  forgotPasswordSchema,
  type ForgotPasswordValues
} from "../features/auth/auth-schemas";

export function ForgotPasswordPage() {
  const { t } = useTranslation(["auth", "common"]);
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" }
  });

  async function onSubmit(values: ForgotPasswordValues) {
    try {
      const result = await forgotPassword(values.email);
      window.sessionStorage.setItem("alveryn.passwordResetEmail", values.email.trim().toLowerCase());
      navigate("/reset-password", {
        state: { email: values.email.trim().toLowerCase(), message: result.message }
      });
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
        <Link to="/login">← {t("auth:forgotPassword.backToLogin")}</Link>
      }
    >
      <form className="auth-form" onSubmit={form.handleSubmit(onSubmit)}>
        <Input
          label={t("common:labels.email")}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={t("auth:placeholders.email")}
          error={form.formState.errors.email?.message}
          {...form.register("email")}
        />
        {message ? <div className="auth-form-error" role="alert" aria-live="polite">{message}</div> : null}
        <Button className="auth-submit" type="submit" disabled={form.formState.isSubmitting} aria-busy={form.formState.isSubmitting}>
          <AuthSubmitContent loading={form.formState.isSubmitting} loadingLabel={t("auth:forgotPassword.submitting")} label={t("auth:forgotPassword.submit")} />
        </Button>
      </form>
    </AuthCard>
  );
}
