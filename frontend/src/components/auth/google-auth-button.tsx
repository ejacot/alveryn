import { useTranslation } from "react-i18next";
import { buildApiUrl } from "../../api/config";

export function GoogleAuthButton() {
  const { t } = useTranslation("auth");

  return (
    <a
      className="flex min-h-12 w-full items-center justify-center gap-3 rounded-full border border-white/12 bg-white/[0.06] px-5 text-sm font-semibold text-white transition hover:bg-white/[0.1] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/55"
      href={buildApiUrl("/api/auth/oauth/google/start")}
    >
      <span
        className="grid size-5 place-items-center rounded-full bg-white text-[13px] font-black text-black"
        aria-hidden="true"
      >
        G
      </span>
      {t("oauth.google")}
    </a>
  );
}
