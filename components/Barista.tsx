type Props = {
  size?: number;
  className?: string;
  alt?: string;
};

/**
 * Barista-avatar. Rendert het SVG-bestand uit `/public/Barista.svg` zodat
 * we het ontwerp op één plek beheren (incl. favicon via `app/icon.svg`).
 */
export function Barista({ size = 56, className, alt = "" }: Props) {
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src="/Barista.svg"
      width={size}
      alt={alt}
      className={`barista-anim ${className ?? ""}`.trim()}
      aria-hidden={alt === "" ? true : undefined}
    />
  );
}
