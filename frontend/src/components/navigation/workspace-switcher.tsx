import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { listOrganizations } from "../../api/endpoints";
import { queryKeys } from "../../api/query-keys";
import { setWorkspaceScope, useWorkspaceScope } from "../../features/organization/workspace-scope";

export function WorkspaceSwitcher() {
  const navigate = useNavigate();
  const query = useQuery({ queryKey: queryKeys.organizations.all(), queryFn: listOrganizations });
  const selected = useWorkspaceScope();
  useEffect(() => {
    if (!query.data?.length) return;
    if (!selected || !query.data.some((item) => item.id === selected)) setWorkspaceScope(query.data[0].id);
  }, [query.data, selected]);
  if (!query.data || query.data.length < 2) return null;
  return <label className="flex items-center gap-2 self-end rounded-full border border-white/[0.08] bg-black/35 px-3 py-2">
    <Building2 className="h-4 w-4 text-white/45" />
    <select aria-label="Active workspace" value={selected ?? query.data[0].id}
      onChange={(event) => {
        const id = event.target.value;
        setWorkspaceScope(id);
        navigate(query.data?.find((item) => item.id === id)?.type === "BUSINESS" ? "/business" : "/app");
      }}
      className="max-w-44 bg-transparent text-xs font-semibold text-white outline-none">
      {query.data.map((item) => <option className="bg-[#111]" key={item.id} value={item.id}>{item.name}</option>)}
    </select>
  </label>;
}
