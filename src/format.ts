const oneDecimal = new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 });

export function formatPercent(value: number | null): string {
  return value === null ? '' : `${oneDecimal.format(value)} %`;
}

export function formatCount(value: number): string {
  return oneDecimal.format(value);
}
