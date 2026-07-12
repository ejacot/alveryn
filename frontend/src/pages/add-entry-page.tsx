import { Button } from "../components/ui/button";
import { PlaceholderCard } from "../components/ui/placeholder-card";
import { SectionHeading } from "../components/ui/section-heading";

export function AddEntryPage() {
  return (
    <div className="space-y-5 pb-6">
      <SectionHeading
        eyebrow="Create"
        title="Capture work in one motion."
        description="This entry point is intentionally lightweight now, with room for the full time and unit-based creation flows next."
      />
      <PlaceholderCard
        title="Quick add surface"
        body="The final flow will reuse the same forms, validation, and animation primitives introduced in this milestone."
      />
      <Button className="w-full">Start New Entry</Button>
    </div>
  );
}
