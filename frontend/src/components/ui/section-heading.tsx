type Props = {
  eyebrow: string;
  title: string;
  description?: string;
};

export function SectionHeading({ eyebrow, title, description }: Props) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.24em] text-white/52">
        {eyebrow}
      </p>
      <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.05em] text-white">
        {title}
      </h1>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-6 text-white/66">
          {description}
        </p>
      ) : null}
    </div>
  );
}
