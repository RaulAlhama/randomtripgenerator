// City landing-page data for SEO. Each entry powers a server-rendered
// /ciudad/<slug> page targeting the Spanish long-tail "qué visitar en X".
// Content is hand-written and distinct per city on purpose: thin/duplicated
// boilerplate is what got the site de-indexed before, so keep it unique.

const CITIES = [
  {
    slug: 'madrid',
    name: 'Madrid',
    region: 'Comunidad de Madrid',
    intro:
      'La capital combina los grandes museos del Paseo del Arte con el bullicio de sus plazas y el verde del Retiro. Un casco histórico compacto que se recorre perfectamente a pie, de la Puerta del Sol al Palacio Real.',
    highlights: [
      { name: 'Plaza Mayor', blurb: 'El corazón monumental del Madrid de los Austrias, rodeado de soportales.' },
      { name: 'Museo del Prado', blurb: 'Una de las mejores pinacotecas del mundo, con Velázquez y Goya.' },
      { name: 'Parque del Retiro', blurb: 'El gran pulmón verde, con el Palacio de Cristal y el estanque.' },
      { name: 'Palacio Real', blurb: 'La residencia oficial más grande de Europa occidental.' },
      { name: 'Mercado de San Miguel', blurb: 'Mercado gastronómico de hierro y cristal junto a la Plaza Mayor.' },
      { name: 'Gran Vía', blurb: 'La avenida más icónica, con su arquitectura de principios del siglo XX.' },
    ],
  },
  {
    slug: 'barcelona',
    name: 'Barcelona',
    region: 'Cataluña',
    intro:
      'Entre el mar y la montaña, Barcelona es modernismo de Gaudí, callejuelas medievales del Gótico y una fachada marítima abierta al Mediterráneo. Una ciudad para perderse a pie y en bici por el Eixample.',
    highlights: [
      { name: 'Sagrada Família', blurb: 'La basílica inacabada de Gaudí, símbolo absoluto de la ciudad.' },
      { name: 'Park Güell', blurb: 'Jardín modernista con mosaicos y vistas panorámicas de Barcelona.' },
      { name: 'Barrio Gótico', blurb: 'Laberinto medieval en torno a la Catedral y la Plaça Reial.' },
      { name: 'Casa Batlló', blurb: 'La obra más onírica de Gaudí en pleno Passeig de Gràcia.' },
      { name: 'La Barceloneta', blurb: 'El barrio marinero y su playa, perfectos para el atardecer.' },
      { name: 'Montjuïc', blurb: 'Colina con castillo, jardines y la fuente mágica.' },
    ],
  },
  {
    slug: 'sevilla',
    name: 'Sevilla',
    region: 'Andalucía',
    intro:
      'Sevilla huele a azahar y suena a flamenco. Su legado andalusí y barroco se concentra en un casco histórico de naranjos, patios y callejones que invitan a caminar sin prisa al caer la tarde.',
    highlights: [
      { name: 'Catedral y Giralda', blurb: 'La mayor catedral gótica del mundo y su antiguo alminar almohade.' },
      { name: 'Real Alcázar', blurb: 'Palacio mudéjar con jardines, todavía residencia real.' },
      { name: 'Plaza de España', blurb: 'Semicírculo monumental de azulejos en el Parque de María Luisa.' },
      { name: 'Barrio de Santa Cruz', blurb: 'La antigua judería, de callejones estrechos y patios encalados.' },
      { name: 'Las Setas (Metropol Parasol)', blurb: 'Mirador de madera con vistas sobre los tejados del centro.' },
      { name: 'Torre del Oro', blurb: 'Torre albarrana del siglo XIII a orillas del Guadalquivir.' },
    ],
  },
  {
    slug: 'valencia',
    name: 'Valencia',
    region: 'Comunidad Valenciana',
    intro:
      'Valencia une el casco histórico medieval con la arquitectura futurista de Calatrava y un antiguo cauce convertido en parque. Ciudad mediterránea, llana y muy ciclable, cuna de la paella.',
    highlights: [
      { name: 'Ciudad de las Artes y las Ciencias', blurb: 'Complejo futurista de Calatrava con oceanográfico y planetario.' },
      { name: 'Mercado Central', blurb: 'Uno de los mayores mercados de Europa, modernista y lleno de vida.' },
      { name: 'La Lonja de la Seda', blurb: 'Joya del gótico civil declarada Patrimonio de la Humanidad.' },
      { name: 'Barrio del Carmen', blurb: 'El núcleo más antiguo, de calles estrechas y arte urbano.' },
      { name: 'Jardín del Turia', blurb: 'Parque de 9 km en el antiguo cauce que cruza la ciudad.' },
      { name: 'Playa de la Malvarrosa', blurb: 'Arena dorada y paseo marítimo a un paso del centro.' },
    ],
  },
  {
    slug: 'granada',
    name: 'Granada',
    region: 'Andalucía',
    intro:
      'A los pies de Sierra Nevada, Granada guarda el conjunto andalusí más impresionante de España. Sus miradores, su tapeo y el laberinto blanco del Albaicín hacen de cada paseo un descubrimiento.',
    highlights: [
      { name: 'La Alhambra', blurb: 'Ciudad palatina nazarí, el monumento más visitado de España.' },
      { name: 'Generalife', blurb: 'Los jardines de recreo de los sultanes, junto a la Alhambra.' },
      { name: 'Albaicín', blurb: 'Barrio morisco de calles empinadas y cármenes con vistas.' },
      { name: 'Mirador de San Nicolás', blurb: 'La postal clásica de la Alhambra con la sierra al fondo.' },
      { name: 'Sacromonte', blurb: 'Barrio de cuevas y cuna del flamenco granadino.' },
      { name: 'Catedral y Capilla Real', blurb: 'Renacimiento monumental y mausoleo de los Reyes Católicos.' },
    ],
  },
  {
    slug: 'bilbao',
    name: 'Bilbao',
    region: 'País Vasco',
    intro:
      'Bilbao pasó de ciudad industrial a icono del diseño gracias al Guggenheim. Hoy mezcla el Casco Viejo de toda la vida, la ría regenerada y una escena gastronómica de pintxos imbatible.',
    highlights: [
      { name: 'Museo Guggenheim', blurb: 'El edificio de titanio de Gehry que cambió la ciudad para siempre.' },
      { name: 'Casco Viejo', blurb: 'Las Siete Calles originales, llenas de bares de pintxos.' },
      { name: 'Mercado de la Ribera', blurb: 'Mercado cubierto a orillas de la ría, de estilo art déco.' },
      { name: 'Puente de Vizcaya', blurb: 'El puente transbordador más antiguo del mundo, Patrimonio.' },
      { name: 'Azkuna Zentroa', blurb: 'Antigua alhóndiga reconvertida por Philippe Starck.' },
      { name: 'Paseo de la ría', blurb: 'El eje verde que conecta los puentes y museos de la ciudad.' },
    ],
  },
  {
    slug: 'malaga',
    name: 'Málaga',
    region: 'Andalucía',
    intro:
      'Cuna de Picasso y puerta de la Costa del Sol, Málaga combina herencia romana y andalusí con un centro peatonal vibrante, museos de primer nivel y playas urbanas bañadas de sol todo el año.',
    highlights: [
      { name: 'Alcazaba', blurb: 'Fortaleza palaciega musulmana muy bien conservada sobre la ciudad.' },
      { name: 'Teatro Romano', blurb: 'Vestigio del siglo I a.C. a los pies de la Alcazaba.' },
      { name: 'Museo Picasso', blurb: 'Colección dedicada al pintor malagueño en un palacio del XVI.' },
      { name: 'Castillo de Gibralfaro', blurb: 'Mirador amurallado con las mejores vistas de la bahía.' },
      { name: 'Catedral (La Manquita)', blurb: 'Catedral renacentista célebre por su torre inacabada.' },
      { name: 'Muelle Uno y La Malagueta', blurb: 'Paseo portuario y playa urbana junto al centro.' },
    ],
  },
  {
    slug: 'zaragoza',
    name: 'Zaragoza',
    region: 'Aragón',
    intro:
      'A orillas del Ebro, Zaragoza acumula dos mil años de historia: romana, musulmana, mudéjar y barroca. Su gran plaza presidida por el Pilar es uno de los espacios monumentales más imponentes de España.',
    highlights: [
      { name: 'Basílica del Pilar', blurb: 'El gran templo barroco a orillas del Ebro, con frescos de Goya.' },
      { name: 'La Seo', blurb: 'Catedral que mezcla románico, gótico, mudéjar y barroco.' },
      { name: 'Palacio de la Aljafería', blurb: 'Palacio andalusí del siglo XI, hoy sede de las Cortes de Aragón.' },
      { name: 'Puente de Piedra', blurb: 'El histórico puente sobre el Ebro con vistas al Pilar.' },
      { name: 'Plaza del Pilar', blurb: 'Una de las mayores plazas peatonales de Europa.' },
      { name: 'El Tubo', blurb: 'Entramado de callejuelas con la mejor oferta de tapas.' },
    ],
  },
  {
    slug: 'san-sebastian',
    name: 'San Sebastián',
    region: 'País Vasco',
    intro:
      'Donostia es elegancia de la Belle Époque abrazando una de las bahías más bellas del mundo. Playa urbana de postal, montes a ambos lados y una Parte Vieja con la mayor densidad de pintxos del país.',
    highlights: [
      { name: 'Playa de la Concha', blurb: 'La bahía en forma de concha, icono de la ciudad.' },
      { name: 'Parte Vieja', blurb: 'Casco histórico con bares de pintxos en cada esquina.' },
      { name: 'Monte Igueldo', blurb: 'Mirador con funicular y vistas completas de la bahía.' },
      { name: 'Monte Urgull', blurb: 'Cerro fortificado entre la Concha y el puerto pesquero.' },
      { name: 'Peine del Viento', blurb: 'Las esculturas de Chillida batidas por el mar.' },
      { name: 'Playa de la Zurriola', blurb: 'La playa surfera, más abierta al Cantábrico.' },
    ],
  },
  {
    slug: 'cordoba',
    name: 'Córdoba',
    region: 'Andalucía',
    intro:
      'Capital de tres culturas, Córdoba alcanzó su esplendor como centro de Al-Ándalus. Su laberinto de patios floridos en torno a la Mezquita-Catedral es uno de los conjuntos históricos más bellos de Europa.',
    highlights: [
      { name: 'Mezquita-Catedral', blurb: 'El bosque de arcos rojiblancos, símbolo de Al-Ándalus.' },
      { name: 'La Judería', blurb: 'Barrio medieval de callejuelas blancas y patios escondidos.' },
      { name: 'Puente Romano', blurb: 'Puente sobre el Guadalquivir con la torre de la Calahorra.' },
      { name: 'Alcázar de los Reyes Cristianos', blurb: 'Fortaleza con jardines y estanques escalonados.' },
      { name: 'Calleja de las Flores', blurb: 'El rincón con macetas y vista a la torre de la Mezquita.' },
      { name: 'Palacio de Viana', blurb: 'Casa-palacio célebre por sus doce patios.' },
    ],
  },
  {
    slug: 'toledo',
    name: 'Toledo',
    region: 'Castilla-La Mancha',
    intro:
      'La ciudad de las tres culturas se alza sobre un meandro del Tajo como un museo al aire libre. Cristianos, judíos y musulmanes dejaron un casco histórico de callejones empinados declarado Patrimonio.',
    highlights: [
      { name: 'Catedral Primada', blurb: 'Obra cumbre del gótico español, sede del primado de España.' },
      { name: 'Alcázar', blurb: 'Fortaleza cuadrangular que corona la ciudad.' },
      { name: 'Sinagoga del Tránsito', blurb: 'Joya mudéjar del barrio judío, hoy Museo Sefardí.' },
      { name: 'San Juan de los Reyes', blurb: 'Monasterio isabelino mandado construir por los Reyes Católicos.' },
      { name: 'Mirador del Valle', blurb: 'La vista clásica de Toledo abrazada por el Tajo.' },
      { name: 'Puente de San Martín', blurb: 'Puente medieval fortificado sobre el río.' },
    ],
  },
  {
    slug: 'santiago-de-compostela',
    name: 'Santiago de Compostela',
    region: 'Galicia',
    intro:
      'Meta de todos los Caminos, Santiago es piedra, lluvia y peregrinos. Su casco antiguo de soportales y plazas graníticas, presidido por la catedral, es uno de los conjuntos urbanos más emocionantes de España.',
    highlights: [
      { name: 'Catedral de Santiago', blurb: 'Destino del Camino, con el Pórtico de la Gloria y el botafumeiro.' },
      { name: 'Praza do Obradoiro', blurb: 'La gran plaza que recibe a los peregrinos ante la fachada barroca.' },
      { name: 'Casco histórico', blurb: 'Calles de soportales de granito, Patrimonio de la Humanidad.' },
      { name: 'Mercado de Abastos', blurb: 'El segundo lugar más visitado, templo del producto gallego.' },
      { name: 'Parque da Alameda', blurb: 'Jardín con la mejor vista del conjunto catedralicio.' },
      { name: 'Monasterio de San Martiño Pinario', blurb: 'Imponente conjunto benedictino junto a la catedral.' },
    ],
  },
];

const CITY_BY_SLUG = Object.fromEntries(CITIES.map((c) => [c.slug, c]));

module.exports = { CITIES, CITY_BY_SLUG };
