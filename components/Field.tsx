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
      <span className="mb-1 flex items-center gap-1 text-sm font-medium text-espresso-600">
        {label}
        {required && <span className="text-crema-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-espresso-400">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-crema-200 bg-white px-3 py-2 text-espresso-700 shadow-sm placeholder:text-espresso-300 focus:border-crema-400 focus:outline-none focus:ring-2 focus:ring-crema-200";
