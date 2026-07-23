import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { getApiError } from "../api/api-errors";
import { AuthCard } from "../components/auth/auth-card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  registerSchema,
  type RegisterValues
} from "../features/auth/auth-schemas";
import { useAuth } from "../features/auth/use-auth";
import { Building2, Check, UserRound } from "lucide-react";

const PENDING_VERIFICATION_EMAIL_KEY = "alveryn.pendingVerificationEmail";

export function RegisterPage() {
  const { t } = useTranslation(["auth", "common"]);
  const navigate = useNavigate();
  const { registerWithPassword } = useAuth();
  const [serverError, setServerError] = useState("");
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      accountType: "PERSONAL",
      companyName: ""
    }
  });

  async function onSubmit(values: RegisterValues) {
    try {
      setServerError("");
      await registerWithPassword(values.email, values.password, values.accountType, values.companyName);
      window.sessionStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, values.email);
      navigate("/verify-email", {
        state: {
          email: values.email
        }
      });
    } catch (error) {
      const apiError = getApiError(error);
      setServerError(apiError.message);
      if (apiError.fieldErrors.email) {
        form.setError("email", { message: apiError.fieldErrors.email });
      }
      if (apiError.fieldErrors.password) {
        form.setError("password", { message: apiError.fieldErrors.password });
      }
    }
  }

  return (
    <AuthCard
      title={t("auth:register.title")}
      footer={
        <span>
          {t("auth:register.footer")}{" "}
          <Link to="/login" className="text-white transition hover:text-white/70">
            {t("auth:register.footerLink")}
          </Link>
        </span>
      }
      backLink={{ to: "/login", label: t("auth:register.backToLogin") }}
    >
      <form className="space-y-3.5" onSubmit={form.handleSubmit(onSubmit)}>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-white/78">
            {t("auth:register.accountTypeLabel")}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: "PERSONAL" as const, icon: UserRound, title: t("auth:register.personal"),
                description: t("auth:register.personalDescription") },
              { value: "BUSINESS" as const, icon: Building2, title: t("auth:register.business"),
                description: t("auth:register.businessDescription") }
            ]).map(({ value, icon: Icon, title, description }) => {
              const selected = form.watch("accountType") === value;
              return <label key={value}
                className={`relative cursor-pointer rounded-2xl border p-3.5 transition ${
                  selected ? "border-white/35 bg-white/[0.1]" : "border-white/[0.09] bg-white/[0.035] hover:bg-white/[0.06]"}`}>
                <input type="radio" value={value} className="sr-only" {...form.register("accountType")} />
                <span className="flex items-center justify-between">
                  <Icon className="h-5 w-5 text-white/70" />
                  {selected ? <Check className="h-4 w-4 text-white" /> : null}
                </span>
                <span className="mt-3 block text-sm font-semibold text-white">{title}</span>
                <span className="mt-1 block text-[11px] leading-4 text-white/42">{description}</span>
              </label>;
            })}
          </div>
        </fieldset>
        {form.watch("accountType") === "BUSINESS" ? (
          <Input
            label={t("auth:register.companyName")}
            autoComplete="organization"
            error={form.formState.errors.companyName?.message}
            {...form.register("companyName")}
          />
        ) : null}
        <Input
          label={t("common:labels.email")}
          type="email"
          error={form.formState.errors.email?.message}
          {...form.register("email")}
        />
        <Input
          label={t("common:labels.password")}
          type="password"
          error={form.formState.errors.password?.message}
          {...form.register("password")}
        />
        {serverError ? <p className="text-sm text-red-300">{serverError}</p> : null}
        <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t("auth:register.submitting") : t("auth:register.submit")}
        </Button>
      </form>
    </AuthCard>
  );
}
