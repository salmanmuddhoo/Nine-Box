import type { CSSProperties } from 'react';
import { shade, tint } from '../colors';
import type { Tier } from '../model/types';

export function tierStyle(tier: Tier | null | undefined): CSSProperties {
  const color = tier?.color ?? '#9a98a8';
  return {
    '--tier': color,
    '--tier-tint': tint(color, 0.86),
    '--tier-soft': tint(color, 0.93),
    '--tier-ink': shade(color, 0.45),
  } as CSSProperties;
}

export function TierBadge({ tier, adjusted = false }: { tier: Tier | null; adjusted?: boolean }) {
  if (!tier) return <span className="tier-badge tier-badge--none">Not placed</span>;
  return (
    <span className="tier-badge" style={tierStyle(tier)} title={adjusted ? 'Tier adjusted manually during calibration' : undefined}>
      {tier.name}
      {adjusted && <span aria-label="adjusted"> ✎</span>}
    </span>
  );
}
