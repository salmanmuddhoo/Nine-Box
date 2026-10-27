/** A generic worker figure (head and shoulders), coloured by the surrounding tier style. */
export function PersonAvatar({ size = 24 }: { size?: number }) {
  return (
    <svg className="avatar" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle className="avatar__bg" cx="12" cy="12" r="12" />
      <circle className="avatar__fg" cx="12" cy="9.3" r="4.3" />
      <path className="avatar__fg" d="M3.06 20C4.6 16 8 14.6 12 14.6S19.4 16 20.94 20A12 12 0 0 1 3.06 20Z" />
    </svg>
  );
}
