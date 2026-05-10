export const easeOutQuart = (t: number): number => 1 - Math.pow(1 - t, 4);

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export const invEaseOutQuart = (y: number): number => 1 - Math.pow(1 - y, 1 / 4);

export const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));
