import { Smartphone, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { isInstalledApp } from "../../api/auth-storage";
import { Card } from "../ui/card";

const DISMISSED_STORAGE_KEY = "alveryn.install-tip-dismissed";

function shouldShowInstallTip() {
  if (typeof window === "undefined" || isInstalledApp()) return false;
  return window.sessionStorage.getItem(DISMISSED_STORAGE_KEY) !== "1";
}

export function InstallAppTip() {
  const { t } = useTranslation("dashboard");
  const [visible, setVisible] = useState(shouldShowInstallTip);

  if (!visible) return null;

  const dismiss = () => {
    window.sessionStorage.setItem(DISMISSED_STORAGE_KEY, "1");
    setVisible(false);
  };

  return (
    <Card as="aside" variant="ambient" className="relative mb-5 overflow-hidden px-5 py-4">
      <div className="flex items-start gap-3 pr-8">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#10b981]/20 bg-[#10b981]/10 text-[#10b981]">
          <Smartphone className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-[var(--text-primary)]">{t("installTip.title")}</p>
          <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
            {t("installTip.description")}
          </p>
          <p className="mt-2 text-xs font-medium text-[#10b981]">{t("installTip.appStore")}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("installTip.dismiss")}
        className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-[var(--text-secondary)] transition hover:bg-white/5 active:scale-95"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </Card>
  );
}
