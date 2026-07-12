import { PlaceholderCard } from "../components/ui/placeholder-card";
import { SectionHeading } from "../components/ui/section-heading";

export function StatisticsPage() {
  return (
    <div className="space-y-5 pb-6">
      <SectionHeading
        eyebrow="Statistics"
        title="Calm analytics, not dashboard noise."
        description="The statistics area is reserved for premium charts and trends without slipping into generic enterprise UI."
      />
      <PlaceholderCard
        title="Statistics foundation"
        body="Future cards will draw from real backend metrics while preserving this restrained visual language."
      />
    </div>
  );
}
