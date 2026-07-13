export function CalendarSkeleton() {
  return (
    <div className="space-y-6 pb-8 animate-pulse">
      <div className="space-y-3">
        <div className="h-5 w-32 rounded-full bg-white/8" />
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 42 }, (_, index) => (
            <div
              key={index}
              className="surface-muted h-[74px] rounded-[24px] bg-white/[0.025]"
            />
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <div className="space-y-3">
          <div className="h-5 w-40 rounded-full bg-white/8" />
          <div className="surface-muted h-32 bg-white/[0.025]" />
          <div className="surface-muted h-24 bg-white/[0.025]" />
        </div>
        <div className="surface-muted h-36 bg-white/[0.025]" />
      </div>
    </div>
  );
}
