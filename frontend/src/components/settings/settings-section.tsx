type Props = {
  title: string;
  children: React.ReactNode;
  description?: string;
};

export function SettingsSection({ title, description, children }: Props) {
  return (
    <section className="space-y-2">
      <div className="space-y-1">
        <p className="hairline-text">{title}</p>
        {description ? <p className="text-sm text-white/42">{description}</p> : null}
      </div>
      <Card className="p-4">
        {children}
      </Card>
    </section>
  );
}
import { Card } from "../ui/card";
