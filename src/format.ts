const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const oneDecimal = new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 });

export function formatMoney(value: number | null, currency: string): string {
  if (value === null) return '';
  return currency ? `${currency} ${number.format(value)}` : number.format(value);
}

export function formatPercent(value: number | null): string {
  return value === null ? '' : `${oneDecimal.format(value)} %`;
}

export function formatCount(value: number): string {
  return oneDecimal.format(value);
}
