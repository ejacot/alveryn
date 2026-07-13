import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getApiError } from "../api/api-errors";
import { listWorkTypes } from "../api/endpoints";
import { settingsKeys } from "../features/settings/settings-keys";
import { SettingsEmptyState } from "../components/settings/settings-empty-state";
import { SettingsPageHeader } from "../components/settings/settings-page-header";
import { Button } from "../components/ui/button";
import { ScreenMessage } from "../components/ui/screen-message";

export function WorkTypesPage() {
  const navigate = useNavigate();
  const workTypesQuery = useQuery({
    queryKey: settingsKeys.workTypes(),
    queryFn: listWorkTypes
  });

  if (workTypesQuery.isLoading) {
    return <ScreenMessage title="Loading work types..." description="Bringing in your saved work configurations." />;
  }

  if (workTypesQuery.error) {
    return <ScreenMessage title="Work types are unavailable" description={getApiError(workTypesQuery.error).message} />;
  }

  const items = [...(workTypesQuery.data ?? [])].sort((left, right) => {
    if (left.active !== right.active) return left.active ? -1 : 1;
    return left.displayOrder - right.displayOrder || left.name.localeCompare(right.name);
  });

  return (
    <div className="space-y-8 pb-10">
      <SettingsPageHeader title="Work types" description="Choose how entries are created. Unit types stay nested only inside unit-based work types." />
      <Button className="w-full gap-2" onClick={() => navigate("/settings/work-types/new")}>
        <Plus className="h-4 w-4" />
        Add work type
      </Button>

      {!items.length ? (
        <SettingsEmptyState
          title="No work types yet"
          description="Create your first time-based or unit-based type to start tracking work."
          actionLabel="Add work type"
          onAction={() => navigate("/settings/work-types/new")}
        />
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(`/settings/work-types/${item.id}`)}
              className="w-full rounded-[28px] border border-white/[0.05] bg-white/[0.035] px-5 py-5 text-left transition hover:bg-white/[0.045] focus:outline-none focus:ring-2 focus:ring-white/24"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-4">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
                  <div className="space-y-1">
                    <p className={`text-[1.05rem] font-semibold tracking-[-0.04em] ${item.active ? "text-white" : "text-white/42"}`}>
                      {item.name}
                    </p>
                    <p className="text-sm text-white/46">
                      {item.calculationMethod === "TIME_BASED" ? "Time based" : "Unit based"}
                    </p>
                  </div>
                </div>
                <span className="text-xs uppercase tracking-[0.16em] text-white/28">
                  {item.active ? "Active" : "Inactive"}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
