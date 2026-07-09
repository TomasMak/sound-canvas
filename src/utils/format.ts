export const formatPercent = (value: number): string =>
  `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;

export const formatHz = (value: number): string => `${Math.round(value)} Hz`;

export const formatBpm = (value: number): string => `${Math.round(value)} BPM`;
