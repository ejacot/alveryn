type Props = {
  title: string;
  description?: string;
};

export function ScreenMessage({ title, description }: Props) {
  return (
    <div className="screen-shell flex min-h-screen items-center justify-center">
      <div className="glass-panel w-full max-w-sm rounded-[28px] px-5 py-4 text-center">
        <p className="text-sm font-semibold text-white">{title}</p>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-white/62">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
