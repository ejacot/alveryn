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
    <div className="mx-auto flex h-screen h-[100dvh] w-full max-w-[520px] items-center justify-center overflow-hidden overscroll-none px-5 py-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="w-full">
        <div className="mb-7 flex justify-center">
          <AppLogo />
        </div>
        <Card variant="auth" className="rounded-2xl border-white/[0.1] bg-[#171717] p-5 shadow-[0_24px_80px_rgba(0,0,0,.35)] sm:p-6">
        <div className="space-y-1.5 text-center">
          <h1 className="text-[1.65rem] font-semibold leading-tight tracking-[-0.045em] text-white">
            {title}
          </h1>
          {subtitle ? (
            <p className="mx-auto max-w-sm text-[0.82rem] leading-5 text-white/48">{subtitle}</p>
          ) : null}
        </div>
        <div className="mt-6">{children}</div>
        {footer ? (
          <div className="mt-5 border-t border-white/[0.07] pt-4 text-center text-sm text-white/48">
            {footer}
          </div>
        ) : null}
        {backLink ? (
          <div className="mt-2 text-center text-xs">
            <Link
              to={backLink.to}
              className="text-white/46 transition hover:text-white/70"
            >
              {backLink.label}
            </Link>
          </div>
        ) : null}
        </Card>
        <div className="mt-4 text-center text-[0.68rem] leading-4 text-white/24">
          {t("legal.footnote")}
        </div>
      </div>
    </div>
  );
}
