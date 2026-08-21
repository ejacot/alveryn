import { Building2, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../../contexts/workspace-context";

export function WorkspaceSwitcher() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const {
    organizations,
    activeWorkspace,
    activeWorkspaceId,
    isLoading,
    setActiveWorkspaceId,
  } = useWorkspace();

  if (isLoading || !activeWorkspaceId || organizations.length === 0) return null;

  const Icon = activeWorkspace?.type === "BUSINESS" ? Building2 : UserRound;

  return (
    <div className="mx-auto flex w-full max-w-[1500px] items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 backdrop-blur-xl">
      <Icon className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
      <label className="min-w-0 flex-1">
        <span className="sr-only">{t("workspace.label")}</span>
        <select
          aria-label={t("workspace.label")}
          value={activeWorkspaceId}
          onChange={(event) => {
            const organization = organizations.find(
              (item) => item.id === event.target.value,
            );
            if (!organization) return;
            setActiveWorkspaceId(organization.id);
            navigate(organization.type === "BUSINESS" ? "/business" : "/app");
          }}
          className="w-full appearance-none bg-transparent text-sm font-semibold text-white outline-none"
        >
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.type === "PERSONAL"
                ? `${t("workspace.personal")} · ${organization.name}`
                : organization.name}
            </option>
          ))}
        </select>
      </label>
      <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-white/45">
        {t(
          activeWorkspace?.type === "BUSINESS"
            ? "workspace.business"
            : "workspace.personal",
        )}
      </span>
    </div>
  );
}
