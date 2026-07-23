import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Link, useLocation } from "react-router-dom";
import { acceptOrganizationInvitation } from "../api/endpoints";
import { queryKeys } from "../api/query-keys";
import { getApiError } from "../api/api-errors";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { setWorkspaceScope } from "../features/organization/workspace-scope";
import { useAuth } from "../features/auth/use-auth";
import { ScreenMessage } from "../components/ui/screen-message";

export function AcceptInvitationPage() {
  const [params] = useSearchParams(); const navigate = useNavigate(); const client = useQueryClient();
  const location = useLocation();
  const { isAuthenticated, isHydrating } = useAuth();
  const token = params.get("token") ?? "";
  const mutation = useMutation({
    mutationFn: () => acceptOrganizationInvitation(token),
    onSuccess: async (organization) => {
      setWorkspaceScope(organization.id);
      await client.invalidateQueries({ queryKey: queryKeys.organizations.all() });
      navigate("/business", { replace: true });
    }
  });
  if (isHydrating) return <ScreenMessage title="Loading invitation..." />;
  return <div className="mx-auto w-full max-w-md pt-16"><Card className="space-y-5 p-6">
    <div><h1 className="text-2xl font-semibold text-white">Join the team</h1>
      <p className="mt-2 text-sm leading-6 text-white/48">Accept this invitation to access the company workspace in Alveryn.</p></div>
    {!token ? <p className="text-sm text-red-300">The invitation link is incomplete.</p> : null}
    {mutation.error ? <p className="text-sm text-red-300">{getApiError(mutation.error).message}</p> : null}
    {isAuthenticated ? (
      <Button className="w-full" disabled={!token || mutation.isPending} onClick={() => mutation.mutate()}>
        Accept invitation
      </Button>
    ) : (
      <div className="space-y-3">
        <Link
          className="flex min-h-11 w-full items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-black"
          to={`/register?invitation=${encodeURIComponent(token)}`}
        >
          Create account
        </Link>
        <Link
          className="flex min-h-11 w-full items-center justify-center rounded-xl border border-white/[0.12] px-4 text-sm font-semibold text-white"
          to="/login"
          state={{ from: location }}
        >
          I already have an account
        </Link>
      </div>
    )}
  </Card></div>;
}
