import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
        state: { message: "Password reset successfully. Sign in with your new password." }
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
      title="Choose a new password"
      subtitle="This flow is wired to the live backend reset endpoint and stays visually aligned with the rest of the product."
      footer={
        <span>
          Need a code first?{" "}
          <Link
            to="/forgot-password"
            className="text-white transition hover:text-white/70"
          >
            Request one
          </Link>
        </span>
      }
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
        <Input
          label="New password"
          type="password"
          error={form.formState.errors.newPassword?.message}
          {...form.register("newPassword")}
        />
        {message ? <p className="text-sm text-white/54">{message}</p> : null}
        <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Updating..." : "Reset password"}
        </Button>
      </form>
    </AuthCard>
  );
}
