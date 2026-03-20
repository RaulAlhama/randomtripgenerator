export const TRANSPORTS = [
  { key: 'driving', icon: '\u{1F697}', label: 'Coche' },
  { key: 'walking', icon: '\u{1F6B6}', label: 'A pie' },
  { key: 'cycling', icon: '\u{1F6B2}', label: 'Bici' },
];

export const SLIDER_DEFAULTS = {
  driving: { min: 2, max: 20, value: 5, step: 0.5 },
  walking: { min: 0.5, max: 10, value: 2, step: 0.5 },
  cycling: { min: 1, max: 15, value: 5, step: 0.5 },
};

export const MODE_LABELS = {
  driving: '\u{1F697} Coche',
  walking: '\u{1F6B6} A pie',
  cycling: '\u{1F6B4} Bici',
};
