import type { ReactNode } from "react";

type Props = {
  label: string;
  htmlFor?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
};

export function Field({ label, htmlFor, hint, required, children }: Props) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-ink-400">
        {label}
        {required && <span className="ml-0.5 text-gold-500">*</span>}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-xs text-ink-300">{hint}</span>
      )}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-line bg-card px-3 py-2.5 text-ink-800 placeholder:text-ink-200 transition focus:border-ink-400 focus:outline-none focus:ring-2 focus:ring-ink-100";
