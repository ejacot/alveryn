import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
        state: { message: "Email verified successfully. Sign in to continue." }
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
      setMessage("Enter your email before requesting a new verification code.");
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
      title="Verify your email"
      subtitle="A clean verification step that respects the existing hardened backend flow."
      backLink={{ to: "/login", label: "Back to login" }}
    >
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <Input
          label="Email"
          type="email"
          error={form.formState.errors.email?.message}
          {...form.register("email")}
        />
        <Input
          label="Verification code"
          error={form.formState.errors.code?.message}
          {...form.register("code")}
        />
        {message ? <p className="text-sm text-white/54">{message}</p> : null}
        <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Verifying..." : "Verify email"}
        </Button>
        <Button
          className="w-full"
          variant="secondary"
          type="button"
          onClick={() => void handleResend()}
        >
          Resend code
        </Button>
      </form>
    </AuthCard>
  );
}
