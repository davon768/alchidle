const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg'];

let notation: 'suffix' | 'sci' = 'suffix';

export function setNotation(n: 'suffix' | 'sci'): void {
  notation = n;
}

/** Compact number: 1234 -> 1.23K, 1e40 -> 1.00e40. */
export function fmt(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : '-∞';
  const sign = n < 0 ? '-' : '';
  n = Math.abs(n);
  if (n < 1000) {
    if (Number.isInteger(n)) return sign + n.toString();
    return sign + (n < 10 ? n.toFixed(Math.min(decimals, 2)) : n.toFixed(n < 100 ? 1 : 0));
  }
  const exp = Math.floor(Math.log10(n));
  if (notation === 'sci' || exp >= SUFFIXES.length * 3) {
    return sign + (n / 10 ** exp).toFixed(decimals) + 'e' + exp;
  }
  const tier = Math.floor(exp / 3);
  const scaled = n / 10 ** (tier * 3);
  const d = scaled >= 100 ? Math.max(0, decimals - 2) : scaled >= 10 ? Math.max(0, decimals - 1) : decimals;
  return sign + scaled.toFixed(d) + SUFFIXES[tier];
}

export function fmtInt(n: number): string {
  return n < 1000 ? Math.floor(n).toString() : fmt(n);
}

export function fmtPct(fraction: number, decimals = 0): string {
  return (fraction * 100).toFixed(decimals) + '%';
}

/** 75 -> "1m 15s", 90000 -> "1d 1h" */
export function fmtTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '∞';
  seconds = Math.max(0, seconds);
  if (seconds < 10) return seconds.toFixed(1) + 's';
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor((seconds / 3600) % 24);
  const d = Math.floor(seconds / 86400);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
