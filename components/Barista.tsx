type Props = {
  size?: number;
  className?: string;
};

/**
 * Minimal barista figure: chef cap, head, apron. Drawn in stroke
 * so it inherits the surrounding color from `currentColor`.
 */
export function Barista({ size = 56, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 72"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* cap top */}
      <path d="M22 8 q-6 2 -5 8 q-5 2 -3 8 h28 q2 -6 -3 -8 q1 -6 -5 -8 q-3 -4 -6 0 q-3 -4 -6 0 z" fill="#ffffff" />
      {/* cap band */}
      <path d="M16 24 h32 v4 h-32 z" fill="#ffffff" />
      {/* head */}
      <ellipse cx="32" cy="36" rx="9" ry="9" fill="#ffffff" />
      {/* eyes */}
      <circle cx="29" cy="35" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="35" cy="35" r="0.9" fill="currentColor" stroke="none" />
      {/* mouth */}
      <path d="M29.5 39 q2.5 1.6 5 0" />
      {/* shoulders / apron */}
      <path d="M16 64 q0 -16 16 -16 q16 0 16 16 z" fill="#ffffff" />
      {/* apron strap */}
      <path d="M26 48 l-3 -3 M38 48 l3 -3" />
      {/* small cup in hand */}
      <path d="M44 56 h6 v4 a2 2 0 0 1 -2 2 h-2 a2 2 0 0 1 -2 -2 z" fill="#ffffff" />
      {/* steam */}
      <path d="M46 53 q1 -1.5 0 -3" />
      <path d="M48 53 q1 -1.5 0 -3" />
    </svg>
  );
}
