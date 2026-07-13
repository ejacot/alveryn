type Props = {
  title: string;
  children: React.ReactNode;
  description?: string;
};

export function SettingsSection({ title, description, children }: Props) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <p className="text-[11px] uppercase tracking-[0.24em] text-white/32">{title}</p>
        {description ? <p className="text-sm text-white/42">{description}</p> : null}
      </div>
      <div className="rounded-[30px] border border-white/[0.05] bg-white/[0.035] p-5 backdrop-blur-sm">
        {children}
      </div>
    </section>
  );
}
