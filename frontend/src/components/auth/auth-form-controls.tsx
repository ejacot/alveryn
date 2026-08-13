import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

export function PasswordVisibilityButton({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  const { t } = useTranslation("auth");
  return (
    <button
      type="button"
      className="auth-password-toggle"
      onClick={onClick}
      aria-label={t(visible ? "password.hide" : "password.show")}
      aria-pressed={visible}
    >
      {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      <span>{t(visible ? "password.hideShort" : "password.showShort")}</span>
    </button>
  );
}

export function AuthSubmitContent({ loading, loadingLabel, label }: { loading: boolean; loadingLabel: string; label: string }) {
  return <>{loading ? <LoaderCircle className="auth-spinner" aria-hidden="true" /> : null}<span>{loading ? loadingLabel : label}</span></>;
}
