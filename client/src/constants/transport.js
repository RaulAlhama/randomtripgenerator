export const TRANSPORTS = [
  { key: 'driving', label: 'Coche' },
  { key: 'walking', label: 'A pie' },
  { key: 'cycling', label: 'Bici' },
];

export const SLIDER_DEFAULTS = {
  driving: { min: 2, max: 20, value: 5, step: 0.5 },
  walking: { min: 0.5, max: 10, value: 2, step: 0.5 },
  cycling: { min: 1, max: 15, value: 5, step: 0.5 },
};
