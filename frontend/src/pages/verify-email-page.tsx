import { useMemo, useState } from "react";
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

export function VerifyEmailPage() {
  const { t } = useTranslation(["auth", "common"]);
  const location = useLocation();
  const navigate = useNavigate();
  const [message, setMessage] = useState(
    ((location.state as { message?: string } | null)?.message ?? "")
  );
  const defaultEmail = useMemo(
    () => ((location.state as { email?: string } | null)?.email ?? ""),
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
      setMessage(result.message);
      navigate("/login", {
        replace: true,
        state: { message: t("auth:verifyEmail.successNavigate") }
      });
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
    const email = form.getValues("email");
    if (!email) {
      setMessage(t("auth:verifyEmail.missingEmail"));
      return;
    }
    try {
      const result = await resendVerification(email);
      setMessage(result.message);
    } catch (error) {
      setMessage(getApiError(error).message);
    }
  }

  return (
    <AuthCard
      title={t("auth:verifyEmail.title")}
      subtitle={t("auth:verifyEmail.subtitle")}
      backLink={{ to: "/login", label: t("auth:verifyEmail.backToLogin") }}
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
        {message ? <p className="text-sm text-white/54">{message}</p> : null}
        <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t("auth:verifyEmail.submitting") : t("auth:verifyEmail.submit")}
        </Button>
        <Button
          className="w-full"
          variant="secondary"
          type="button"
          onClick={() => void handleResend()}
        >
          {t("auth:verifyEmail.resend")}
        </Button>
      </form>
    </AuthCard>
  );
}
