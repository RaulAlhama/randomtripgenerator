// Numbers as a Spanish reader writes them: "1,8 km", "4,7". The city pages
// already used the comma, while the route view, the Rutas tab, the walk and
// the ratings printed "1.8 km" and "★ 4.7", so the same route read as
// "4,5 km" on its page and "1.9 km" one tap later.

export function formatDecimal(value, digits = 1) {
  return Number(value).toFixed(digits).replace('.', ',');
}

export function formatKm(meters) {
  return `${formatDecimal(meters / 1000)} km`;
}
