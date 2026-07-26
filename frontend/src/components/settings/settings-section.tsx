import { Card, CardModuleTitle } from "../ui/card";

type Props = {
  title: string;
  children: React.ReactNode;
  description?: string;
};

export function SettingsSection({ title, description, children }: Props) {
  return (
    <section>
      <Card variant="ambient" className="p-4">
        <CardModuleTitle className={description ? "mb-2" : undefined}>{title}</CardModuleTitle>
        {description ? <p className="mb-4 text-center text-sm text-white/42">{description}</p> : null}
        {children}
      </Card>
    </section>
  );
}
