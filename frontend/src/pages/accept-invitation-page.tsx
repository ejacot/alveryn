import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { acceptOrganizationInvitation } from "../api/endpoints";
import { queryKeys } from "../api/query-keys";
import { getApiError } from "../api/api-errors";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { setWorkspaceScope } from "../features/organization/workspace-scope";

export function AcceptInvitationPage() {
  const [params] = useSearchParams(); const navigate = useNavigate(); const client = useQueryClient();
  const token = params.get("token") ?? "";
  const mutation = useMutation({
    mutationFn: () => acceptOrganizationInvitation(token),
    onSuccess: async (organization) => {
      setWorkspaceScope(organization.id);
      await client.invalidateQueries({ queryKey: queryKeys.organizations.all() });
      navigate("/settings/business", { replace: true });
    }
  });
  return <div className="mx-auto w-full max-w-md pt-16"><Card className="space-y-5 p-6">
    <div><h1 className="text-2xl font-semibold text-white">Join the team</h1>
      <p className="mt-2 text-sm leading-6 text-white/48">Accept this invitation to access the company workspace in Alveryn.</p></div>
    {!token ? <p className="text-sm text-red-300">The invitation link is incomplete.</p> : null}
    {mutation.error ? <p className="text-sm text-red-300">{getApiError(mutation.error).message}</p> : null}
    <Button className="w-full" disabled={!token || mutation.isPending} onClick={() => mutation.mutate()}>
      Accept invitation
    </Button>
  </Card></div>;
}
