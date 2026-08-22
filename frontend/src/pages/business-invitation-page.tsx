import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { acceptBusinessInvitation, declineBusinessInvitation, getBusinessInvitation } from "../api/endpoints";
import { Button } from "../components/ui/button";
import { ScreenMessage } from "../components/ui/screen-message";
import { useAuth } from "../features/auth/use-auth";

export function BusinessInvitationPage() {
  const { token = "" } = useParams();
  const { isAuthenticated, user, refreshCurrentUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const invitation = useQuery({ queryKey: ["business-invitation", token], queryFn: () => getBusinessInvitation(token), retry: false });
  const accept = useMutation({ mutationFn: () => acceptBusinessInvitation(token), onSuccess: async () => {
    await refreshCurrentUser(); await queryClient.invalidateQueries({ queryKey: ["organizations"] }); navigate("/business", { replace: true });
  }});
  const decline = useMutation({ mutationFn: () => declineBusinessInvitation(token), onSuccess: (data) => queryClient.setQueryData(["business-invitation", token], data) });
  if (invitation.isPending) return <ScreenMessage title="Loading invitation..." />;
  if (!invitation.data || invitation.isError) return <ScreenMessage title="This invitation is invalid or no longer available." />;
  const data = invitation.data;
  if (data.status !== "PENDING") return <ScreenMessage title={data.status === "ACTIVE" ? "Invitation accepted" : data.status === "EXPIRED" ? "Invitation expired" : "Invitation declined"} />;
  const wrongAccount = isAuthenticated && user?.account.email.toLowerCase() !== data.invitedEmail?.toLowerCase();
  return <main className="auth-page"><section className="auth-card"><p className="auth-eyebrow">ALVERYN BUSINESS</p><h1>Join {data.organizationName}</h1><p>You were invited as {data.invitedEmail}.</p>
    {wrongAccount ? <p role="alert">Sign in with {data.invitedEmail} to accept this invitation.</p> : null}
    <div className="auth-form">
      {isAuthenticated ? <Button disabled={wrongAccount || accept.isPending} onClick={() => accept.mutate()}>Accept invitation</Button>
        : <><Link className="auth-submit" to="/login" state={{from:{pathname:`/business-invitation/${token}`}}}>Sign in to accept</Link><Link to={`/register?email=${encodeURIComponent(data.invitedEmail ?? "")}`}>Create an account</Link></>}
      <Button variant="secondary" disabled={decline.isPending} onClick={() => decline.mutate()}>Decline</Button>
    </div>
  </section></main>;
}
