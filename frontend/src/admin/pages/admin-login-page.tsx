import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { getApiError } from "../../api/api-errors";
import { AuthCard } from "../../components/auth/auth-card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { loginSchema, type LoginValues } from "../../features/auth/auth-schemas";
import { useAuth } from "../../features/auth/use-auth";

export function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithPassword, logout } = useAuth();
  const [serverError, setServerError] = useState(
    (location.state as { unauthorized?: boolean } | null)?.unauthorized
      ? "This account does not have administrator access."
      : ""
  );
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" }
  });

  async function onSubmit(values: LoginValues) {
    try {
      setServerError("");
      const user = await loginWithPassword(values.email, values.password);
      if (!user.founder) {
        await logout();
        setServerError("This account does not have administrator access.");
        return;
      }
      navigate("/", { replace: true });
    } catch (error) {
      setServerError(getApiError(error).message);
    }
  }

  return (
    <div className="fixed inset-0 overflow-hidden overscroll-none bg-black">
      <AuthCard title="Admin access" subtitle="Private access to Alveryn product analytics.">
        <form className="space-y-3.5" onSubmit={form.handleSubmit(onSubmit)}>
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
          {serverError ? <p className="text-sm text-red-300">{serverError}</p> : null}
          <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </AuthCard>
    </div>
  );
}
