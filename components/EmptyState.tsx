import Link from "next/link";

type Props = {
  title: string;
  description: string;
  ctaHref?: string;
  ctaLabel?: string;
};

export function EmptyState({ title, description, ctaHref, ctaLabel }: Props) {
  return (
    <div className="rounded-2xl border border-dashed border-crema-200 bg-white/50 p-8 text-center">
      <p className="text-3xl">☕</p>
      <h3 className="mt-2 text-lg font-semibold text-espresso-700">{title}</h3>
      <p className="mt-1 text-sm text-espresso-400">{description}</p>
      {ctaHref && ctaLabel && (
        <Link
          href={ctaHref}
          className="mt-4 inline-block rounded-full bg-espresso-600 px-4 py-2 text-sm font-medium text-crema-50 transition hover:bg-espresso-700"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
