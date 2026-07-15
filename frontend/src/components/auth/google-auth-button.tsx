import { useTranslation } from "react-i18next";
import { buildApiUrl } from "../../api/config";

export function GoogleAuthButton() {
  const { t } = useTranslation("auth");

  return (
    <a
      className="group relative flex min-h-12 w-full items-center justify-center gap-3 overflow-hidden rounded-full border border-white/[0.1] bg-white/[0.92] px-5 text-sm font-semibold text-black shadow-[0_18px_45px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.85)] transition duration-200 hover:bg-white active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/55"
      href={buildApiUrl("/api/auth/oauth/google/start")}
    >
      <span className="pointer-events-none absolute inset-x-8 top-0 h-px bg-black/10" />
      <span
        className="grid size-6 place-items-center rounded-full border border-black/[0.08] bg-white text-[13px] font-black text-[#4285f4] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
        aria-hidden="true"
      >
        G
      </span>
      {t("oauth.google")}
    </a>
  );
}
