import { PlaceholderCard } from "../components/ui/placeholder-card";
import { SectionHeading } from "../components/ui/section-heading";

export function CalendarPage() {
  return (
    <div className="space-y-5 pb-6">
      <SectionHeading
        eyebrow="Calendar"
        title="Your week at a glance."
        description="The calendar surface will evolve from the same week-selector language already used on the dashboard."
      />
      <PlaceholderCard
        title="Calendar foundation"
        body="Reserved for the scrollable week and month views, absence overlays, and entry density indicators."
      />
    </div>
  );
}
