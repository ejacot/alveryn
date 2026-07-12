import { Link } from "react-router-dom";
import { AppLogo } from "../branding/app-logo";

type Props = {
  title: string;
  subtitle: string;
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
  return (
    <div className="screen-shell flex min-h-screen items-center justify-center pb-10">
      <div className="glass-panel w-full rounded-[36px] p-6">
        <AppLogo />
        <div className="mt-8 space-y-2">
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white">
            {title}
          </h1>
          <p className="max-w-sm text-sm leading-6 text-white/68">{subtitle}</p>
        </div>
        <div className="mt-8">{children}</div>
        {footer ? (
          <div className="mt-6 border-t border-white/10 pt-5 text-sm text-white/62">
            {footer}
          </div>
        ) : null}
        <div className="mt-6 text-center text-xs text-white/40">
          By continuing you agree to the Roomly product flow.
        </div>
        {backLink ? (
          <div className="mt-3 text-center text-xs">
            <Link
              to={backLink.to}
              className="text-white/46 transition hover:text-white/70"
            >
              {backLink.label}
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
