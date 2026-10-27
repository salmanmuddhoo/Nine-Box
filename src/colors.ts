/** Mixes a hex colour with white. amount 0 keeps the colour, 1 gives white. */
export function tint(hex: string, amount: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c + (255 - c) * amount));
  return '#' + channels.map((c) => c.toString(16).padStart(2, '0')).join('');
}

/** Darkens a hex colour towards black, for text on a tinted background. amount 0 keeps the colour. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c * (1 - amount)));
  return '#' + channels.map((c) => c.toString(16).padStart(2, '0')).join('');
}
