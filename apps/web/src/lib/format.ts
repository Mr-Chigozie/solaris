const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const compactNaira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', notation: 'compact', maximumFractionDigits: 1 });

export const formatNaira = (value: number | string) => naira.format(Number(value));
export const formatNairaCompact = (value: number | string) => compactNaira.format(Number(value));

export function formatNumber(value: number | string, decimals = 1) {
  return new Intl.NumberFormat('en-NG', { maximumFractionDigits: decimals }).format(Number(value));
}

export function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}
