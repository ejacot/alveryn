import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { getApiError } from "../api/api-errors";
import { resetPassword } from "../api/endpoints";
import { AuthCard } from "../components/auth/auth-card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  resetPasswordSchema,
  type ResetPasswordValues
} from "../features/auth/auth-schemas";

export function ResetPasswordPage() {
  const { t } = useTranslation(["auth", "common"]);
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: "",
      code: "",
      newPassword: ""
    }
  });

  async function onSubmit(values: ResetPasswordValues) {
    try {
      const result = await resetPassword(values);
      setMessage(result.message);
      navigate("/login", {
        replace: true,
        state: { message: t("auth:resetPassword.successNavigate") }
      });
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
      title={t("auth:resetPassword.title")}
      subtitle={t("auth:resetPassword.subtitle")}
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
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <Input
          label={t("common:labels.email")}
          type="email"
          error={form.formState.errors.email?.message}
          {...form.register("email")}
        />
        <Input
          label={t("common:labels.verificationCode")}
          error={form.formState.errors.code?.message}
          {...form.register("code")}
        />
        <Input
          label={t("common:labels.newPassword")}
          type="password"
          error={form.formState.errors.newPassword?.message}
          {...form.register("newPassword")}
        />
        {message ? <p className="text-sm text-white/54">{message}</p> : null}
        <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t("auth:resetPassword.submitting") : t("auth:resetPassword.submit")}
        </Button>
      </form>
    </AuthCard>
  );
}
