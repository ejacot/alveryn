import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { AuthCard } from "../components/auth/auth-card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  registerSchema,
  type RegisterValues
} from "../features/auth/auth-schemas";
import { useAuth } from "../features/auth/use-auth";

export function RegisterPage() {
  const navigate = useNavigate();
  const { registerWithPassword } = useAuth();
  const [serverMessage, setServerMessage] = useState("");
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
      setServerMessage("Account created. Check your email for the verification code.");
      navigate("/verify-email", { state: { email: values.email } });
    } catch {
      setServerError("Registration failed. Try a different email or try again.");
    }
  }

  return (
    <AuthCard
      title="Create Roomly"
      subtitle="Minimal onboarding starts here, with a clean registration flow aligned with the backend contract."
      footer={
        <span>
          Already have an account?{" "}
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
        <Input
          label="Password"
          type="password"
          error={form.formState.errors.password?.message}
          {...form.register("password")}
        />
        {serverMessage ? (
          <p className="text-sm text-white/54">{serverMessage}</p>
        ) : null}
        {serverError ? <p className="text-sm text-red-300">{serverError}</p> : null}
        <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Creating..." : "Create account"}
        </Button>
      </form>
    </AuthCard>
  );
}
