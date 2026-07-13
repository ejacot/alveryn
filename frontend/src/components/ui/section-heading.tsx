type Props = {
  eyebrow: string;
  title: string;
  description?: string;
};

export function SectionHeading({ eyebrow, title, description }: Props) {
  return (
    <div className="space-y-2">
      <p className="hairline-text">
        {eyebrow}
      </p>
      <h1 className="text-[2.25rem] font-semibold tracking-[-0.07em] text-white">
        {title}
      </h1>
      {description ? (
        <p className="max-w-md text-sm leading-6 text-white/58">
          {description}
        </p>
      ) : null}
    </div>
  );
}
