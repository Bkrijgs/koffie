import Link from "next/link";

type Props = {
  title: string;
  description?: string;
  ctaHref?: string;
  ctaLabel?: string;
};

export function EmptyState({ title, description, ctaHref, ctaLabel }: Props) {
  return (
    <div className="rounded-xl2 border border-dashed border-line bg-card/40 px-6 py-10 text-center">
      <h3 className="font-display text-base tracking-tightish text-ink-700">
        {title}
      </h3>
      {description && (
        <p className="mt-1 text-sm text-ink-400">{description}</p>
      )}
      {ctaHref && ctaLabel && (
        <Link
          href={ctaHref}
          className="mt-5 inline-block rounded-lg bg-ink-800 px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink-700"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
