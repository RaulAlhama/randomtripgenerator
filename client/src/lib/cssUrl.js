// A URL as a CSS background-image value, quoted. Unquoted, url() ends at the
// first ")" in the address, and Wikidata's photo links carry raw parentheses
// (Special:FilePath/Mercado de Abastos (Toledo) - 01.jpg): the <img> in the
// deck showed the photo, the same place saved in Guardados showed a grey box.
export const cssUrl = (url) => `url(${JSON.stringify(String(url))})`;
