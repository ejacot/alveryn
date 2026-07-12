import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthCard } from "../components/auth/auth-card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  loginSchema,
  type LoginValues
} from "../features/auth/auth-schemas";
import { useAuth } from "../features/auth/use-auth";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithPassword } = useAuth();
  const [serverError, setServerError] = useState("");
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
      setServerError("Unable to log in. Check your credentials and try again.");
    }
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="A quiet, premium authentication flow built for the Roomly product language."
      footer={
        <span>
          New here?{" "}
          <Link to="/register" className="text-white transition hover:text-white/70">
            Create an account
          </Link>
        </span>
      }
    >
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          error={form.formState.errors.email?.message}
          {...form.register("email")}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          error={form.formState.errors.password?.message}
          {...form.register("password")}
        />
        {serverError ? (
          <p className="text-sm text-red-300">{serverError}</p>
        ) : null}
        <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-sm text-white/52 transition hover:text-white/74"
          >
            Forgot password?
          </Link>
        </div>
      </form>
    </AuthCard>
  );
}
