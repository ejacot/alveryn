type Props = {
  title: string;
  body: string;
};

export function PlaceholderCard({ title, body }: Props) {
  return (
    <section className="section-card">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-white/48">{body}</p>
    </section>
  );
}
