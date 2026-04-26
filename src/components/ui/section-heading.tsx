export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-3">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-ember">{eyebrow}</p>
      <h1 className="font-heading text-3xl font-semibold leading-tight text-balance sm:text-4xl lg:text-5xl">
        {title}
      </h1>
      <p className="max-w-3xl text-sm leading-7 text-ink/72 sm:text-base">{description}</p>
    </div>
  );
}
