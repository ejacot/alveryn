import { useAuth } from "../features/auth/use-auth";
import { Button } from "../components/ui/button";
import { PlaceholderCard } from "../components/ui/placeholder-card";
import { SectionHeading } from "../components/ui/section-heading";

export function ProfilePage() {
  const { user, logout } = useAuth();

  return (
    <div className="space-y-5 pb-6">
      <SectionHeading
        eyebrow="Profile"
        title={user?.account.email ?? "Your account"}
        description="Settings, profile editing, and onboarding refinement will layer onto this shell next."
      />
      <PlaceholderCard
        title="Settings foundation"
        body="This screen is ready for profile, preferences, hourly rates, work types, unit types, absences, and onboarding flows."
      />
      <Button variant="secondary" className="w-full" onClick={() => void logout()}>
        Log out
      </Button>
    </div>
  );
}
