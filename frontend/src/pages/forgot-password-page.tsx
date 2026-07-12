import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { forgotPassword } from "../api/endpoints";
import { AuthCard } from "../components/auth/auth-card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  forgotPasswordSchema,
  type ForgotPasswordValues
} from "../features/auth/auth-schemas";

export function ForgotPasswordPage() {
  const [message, setMessage] = useState("");
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" }
  });

  async function onSubmit(values: ForgotPasswordValues) {
    const result = await forgotPassword(values.email);
    setMessage(result.message);
  }

  return (
    <AuthCard
      title="Reset access"
      subtitle="Request a password reset code using the same secure flow already present in the backend."
      footer={
        <span>
          Remembered it?{" "}
          <Link to="/login" className="text-white transition hover:text-white/70">
            Sign in
          </Link>
        </span>
      }
    >
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <Input
          label="Email"
          type="email"
          error={form.formState.errors.email?.message}
          {...form.register("email")}
        />
        {message ? <p className="text-sm text-white/54">{message}</p> : null}
        <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Sending..." : "Send reset code"}
        </Button>
      </form>
    </AuthCard>
  );
}
