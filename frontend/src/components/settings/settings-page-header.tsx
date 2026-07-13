import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Props = {
  title: string;
  description?: string;
};

export function SettingsPageHeader({ title, description }: Props) {
  const navigate = useNavigate();

  return (
    <header className="space-y-3">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.04] text-white/78 transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-white/24"
        aria-label="Go back"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <div className="space-y-2">
        <h1 className="text-[2rem] font-semibold tracking-[-0.07em] text-white">{title}</h1>
        {description ? <p className="max-w-[34rem] text-sm leading-6 text-white/48">{description}</p> : null}
      </div>
    </header>
  );
}
