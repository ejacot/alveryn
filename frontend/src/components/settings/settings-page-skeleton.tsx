export function SettingsPageSkeleton() {
  return (
    <div className="space-y-6 pb-10 pt-4" aria-busy="true" aria-live="polite">
      <div className="space-y-3">
        <div className="h-11 w-11 rounded-full bg-white/[0.06]" />
        <div className="h-10 w-40 rounded-full bg-white/[0.08]" />
        <div className="h-4 w-full max-w-sm rounded-full bg-white/[0.05]" />
      </div>
      <div className="space-y-6">
        <Card className="p-6">
          <div className="space-y-4">
            <div className="h-3 w-24 rounded-full bg-white/[0.08]" />
            <div className="h-12 rounded-2xl bg-white/[0.05]" />
            <div className="h-12 rounded-2xl bg-white/[0.05]" />
            <div className="h-12 rounded-2xl bg-white/[0.05]" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="space-y-4">
            <div className="h-3 w-20 rounded-full bg-white/[0.08]" />
            <div className="h-12 rounded-2xl bg-white/[0.05]" />
            <div className="h-12 rounded-2xl bg-white/[0.05]" />
          </div>
        </Card>
      </div>
    </div>
  );
}
import { Card } from "../ui/card";
