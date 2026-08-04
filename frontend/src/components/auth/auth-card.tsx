import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppLogo } from "../branding/app-logo";
import { Card } from "../ui/card";

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  backLink?: {
    to: string;
    label: string;
  };
};

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
  backLink
}: Props) {
  const { t } = useTranslation(["auth"]);

  return (
    <div className="auth-shell dashboard-glass-preview relative min-h-screen min-h-[100dvh] w-full overflow-x-hidden overscroll-none">
      <div className="pointer-events-none absolute left-1/2 top-[-11rem] h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-[#10b981]/[0.065] blur-[110px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-40 h-80 w-80 rounded-full bg-emerald-900/[0.09] blur-[100px]" />
      <div className="relative mx-auto flex min-h-screen min-h-[100dvh] w-full max-w-[520px] items-center px-5 py-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="w-full py-3">
        <div className="mb-8 flex justify-center">
          <AppLogo wordmark />
        </div>
        <Card variant="auth" className="rounded-[30px] border-white/[0.085] bg-white/[0.035] p-5 shadow-[0_28px_90px_rgba(0,0,0,.42)] backdrop-blur-2xl sm:p-6">
        <div className="space-y-2 text-center">
          <h1 className="text-[2rem] font-semibold leading-[1.05] tracking-[-0.06em] text-[#f5f5f5]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mx-auto max-w-sm text-[0.84rem] leading-5 text-white/45">{subtitle}</p>
          ) : null}
        </div>
        <div className="mt-7">{children}</div>
        {footer ? (
          <div className="mt-6 border-t border-white/[0.065] pt-4 text-center text-sm text-white/42">
            {footer}
          </div>
        ) : null}
        {backLink ? (
          <div className="mt-2 text-center text-xs">
            <Link
              to={backLink.to}
              className="inline-flex min-h-10 items-center text-white/42 transition hover:text-white/70"
            >
              {backLink.label}
            </Link>
          </div>
        ) : null}
        </Card>
        <div className="mt-5 px-4 text-center text-[0.66rem] leading-4 text-white/22">
          {t("legal.footnote")}
        </div>
      </div>
      </div>
    </div>
  );
}
