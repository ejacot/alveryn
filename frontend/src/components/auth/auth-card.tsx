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
    <div className="mx-auto flex h-screen h-[100dvh] w-full max-w-[560px] items-start justify-center overflow-hidden overscroll-none px-5 pb-5 pt-[max(1.75rem,calc(env(safe-area-inset-top)+1rem))]">
      <div className="w-full pt-[clamp(0.5rem,5dvh,3rem)]">
        <div className="mb-7 flex justify-center">
          <AppLogo />
        </div>
        <Card variant="auth" className="p-5 sm:p-6">
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-white/20" />
        <div className="space-y-1">
          <h1 className="text-[1.9rem] font-semibold leading-none tracking-[-0.055em] text-white">
            {title}
          </h1>
          {subtitle ? (
            <p className="max-w-sm text-[0.82rem] leading-5 text-white/46">{subtitle}</p>
          ) : null}
        </div>
        <div className="mt-5">{children}</div>
        {footer ? (
          <div className="mt-4 border-t border-white/[0.07] pt-4 text-center text-sm text-white/48">
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
