// City landing-page data for SEO. Each entry powers a server-rendered
// /ciudad/<slug> page targeting the Spanish long-tail "qué visitar en X".
// Content is hand-written and distinct per city on purpose: thin/duplicated
// boilerplate is what got the site de-indexed before, so keep it unique.

const CITIES = [
  {
    slug: 'madrid',
    name: 'Madrid',
    region: 'Comunidad de Madrid',
    lat: 40.4168,
    lng: -3.7038, // Puerta del Sol
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
    lat: 41.3851,
    lng: 2.1734, // Plaça de Catalunya
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
    lat: 37.3858,
    lng: -5.9933, // Catedral / Av. de la Constitución
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
    lat: 39.4699,
    lng: -0.3763, // Plaza del Ayuntamiento
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
    lat: 37.1765,
    lng: -3.5979, // Plaza Nueva
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
    lat: 43.2569,
    lng: -2.9236, // Casco Viejo
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
    lat: 36.7213,
    lng: -4.4216, // Catedral / calle Larios
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
    lat: 41.6561,
    lng: -0.8773, // Plaza del Pilar
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
    lat: 43.3224,
    lng: -1.9839, // Parte Vieja
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
    lat: 37.8790,
    lng: -4.7794, // Mezquita-Catedral
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
    lat: 39.8581,
    lng: -4.0226, // Plaza de Zocodover
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
    lat: 42.8806,
    lng: -8.5446, // Praza do Obradoiro
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
  // Added 2026-11 because "en 2 horas a pie" turned out to be the format that
  // ranks: 12 such pages brought 57% of all search clicks. Compact historic
  // centres first, where a two-hour walk covers what a visitor came to see.
  // Coordinates are each city's central square or landmark as Nominatim
  // geocodes it, not recalled from memory.
  {
    slug: 'salamanca',
    name: 'Salamanca',
    region: 'Castilla y León',
    lat: 40.9650,
    lng: -5.6641, // Plaza Mayor
    intro:
      'Salamanca es piedra dorada y vida universitaria desde la Edad Media. Su casco histórico, Patrimonio de la Humanidad, reúne en pocas calles dos catedrales, la fachada plateresca de la Universidad y una de las plazas mayores más bellas de España.',
    highlights: [
      { name: 'Plaza Mayor', blurb: 'Plaza barroca porticada, el punto de encuentro de toda la ciudad.' },
      { name: 'Universidad de Salamanca', blurb: 'Una de las universidades más antiguas de Europa, con la rana escondida en su fachada.' },
      { name: 'Catedral Vieja y Catedral Nueva', blurb: 'Dos catedrales pegadas una a otra: la vieja, románica, y la nueva, gótica.' },
      { name: 'Casa de las Conchas', blurb: 'Palacio cubierto de conchas talladas en piedra, hoy biblioteca pública.' },
      { name: 'Puente Romano', blurb: 'El puente sobre el Tormes con la mejor vista de las catedrales.' },
      { name: 'La Clerecía', blurb: 'Antiguo colegio jesuita cuyas torres se suben para ver la ciudad desde arriba.' },
    ],
  },
  {
    slug: 'segovia',
    name: 'Segovia',
    region: 'Castilla y León',
    lat: 40.9503,
    lng: -4.1240, // Plaza Mayor
    intro:
      'Segovia se recorre de punta a punta en una mañana: del acueducto romano a la catedral y de ahí al Alcázar, asomado sobre la confluencia de dos ríos. Su casco antiguo y el acueducto son Patrimonio de la Humanidad.',
    highlights: [
      { name: 'Acueducto', blurb: 'Obra romana de bloques de granito encajados sin argamasa, símbolo de la ciudad.' },
      { name: 'Catedral de Segovia', blurb: 'Una de las últimas catedrales góticas de España, llamada la dama de las catedrales.' },
      { name: 'Alcázar', blurb: 'Castillo sobre un espolón de roca, antigua residencia real y hoy museo.' },
      { name: 'Plaza Mayor', blurb: 'El centro de la vida segoviana, a los pies de la catedral.' },
      { name: 'Judería', blurb: 'Las callejas de la antigua judería, entre la catedral y la muralla.' },
      { name: 'Iglesia de San Millán', blurb: 'Templo románico con galerías porticadas, uno de los muchos de la ciudad.' },
    ],
  },
  {
    slug: 'cadiz',
    name: 'Cádiz',
    region: 'Andalucía',
    lat: 36.5290,
    lng: -6.2953, // Catedral
    intro:
      'Cádiz, rodeada de mar casi por completo, presume de ser una de las ciudades más antiguas de Occidente. Su casco antiguo es un entramado de calles estrechas que desemboca en plazas, baluartes y playas.',
    highlights: [
      { name: 'Catedral de Cádiz', blurb: 'Su cúpula dorada domina el perfil de la ciudad frente al mar.' },
      { name: 'Torre Tavira', blurb: 'Antigua torre vigía con cámara oscura y vistas sobre las azoteas.' },
      { name: 'Playa de La Caleta', blurb: 'La pequeña playa entre dos castillos, famosa por sus atardeceres.' },
      { name: 'Mercado Central', blurb: 'Mercado de abastos con pescado del día y puestos donde comer.' },
      { name: 'Barrio de la Viña', blurb: 'Barrio marinero y flamenco, corazón del Carnaval.' },
      { name: 'Parque Genovés', blurb: 'Jardín junto al mar con árboles recortados en formas geométricas.' },
    ],
  },
  {
    slug: 'caceres',
    name: 'Cáceres',
    region: 'Extremadura',
    lat: 39.4751,
    lng: -6.3715, // Plaza Mayor
    intro:
      'La Ciudad Monumental de Cáceres es uno de los conjuntos medievales mejor conservados de Europa: murallas, torres y casas palacio de piedra que parecen detenidas en el tiempo. Se recorre entera a pie, subiendo desde la Plaza Mayor.',
    highlights: [
      { name: 'Plaza Mayor', blurb: 'La gran plaza a los pies de la muralla, vigilada por la Torre de Bujaco.' },
      { name: 'Arco de la Estrella', blurb: 'La puerta principal de la ciudad intramuros, junto a la Plaza Mayor.' },
      { name: 'Concatedral de Santa María', blurb: 'Templo gótico en el corazón del recinto amurallado.' },
      { name: 'Plaza de San Jorge', blurb: 'Plaza presidida por la fachada blanca de la iglesia de San Francisco Javier.' },
      { name: 'Palacio de los Golfines de Abajo', blurb: 'Casa palacio con una fachada entre el gótico y el plateresco.' },
      { name: 'Barrio de San Antonio', blurb: 'La antigua judería, de casas encaladas y calles en cuesta.' },
    ],
  },
  {
    slug: 'ronda',
    name: 'Ronda',
    region: 'Andalucía',
    lat: 36.7407,
    lng: -5.1659, // Puente Nuevo
    intro:
      'Ronda se asoma a un tajo profundo que parte la ciudad en dos. El Puente Nuevo une el casco antiguo con el barrio del Mercadillo, y desde sus miradores se ve la serranía entera.',
    highlights: [
      { name: 'Puente Nuevo', blurb: 'El puente sobre el Tajo, la imagen más conocida de Ronda.' },
      { name: 'Plaza de Toros de la Real Maestranza', blurb: 'Una de las plazas de toros más antiguas de España, con museo.' },
      { name: 'Baños Árabes', blurb: 'Baños de época andalusí junto al río, de los mejor conservados de la península.' },
      { name: 'Alameda del Tajo', blurb: 'Paseo ajardinado con balcones asomados al precipicio.' },
      { name: 'Casa del Rey Moro', blurb: 'Jardines y una mina de agua excavada en la roca hasta el río.' },
      { name: 'Puente Viejo', blurb: 'Pequeño puente de piedra sobre el Guadalevín, en la parte baja.' },
    ],
  },
  {
    slug: 'girona',
    name: 'Girona',
    // Civitatis' destination page is /es/gerona/; /es/girona/ redirects to its homepage.
    civitatisSlug: 'gerona',
    region: 'Cataluña',
    lat: 41.9875,
    lng: 2.8263, // Catedral
    intro:
      'Girona guarda dentro de sus murallas un Barri Vell de escalinatas y calles empedradas, con el río Onyar y sus casas de colores como frontera. Un casco antiguo pequeño y muy cuidado, hecho para recorrerlo sin coche.',
    highlights: [
      { name: 'Catedral de Girona', blurb: 'Tiene la nave gótica más ancha del mundo y una escalinata monumental.' },
      { name: 'Casas del Onyar', blurb: 'Las fachadas de colores asomadas al río, la postal de la ciudad.' },
      { name: 'El Call', blurb: 'Uno de los barrios judíos medievales mejor conservados de Europa.' },
      { name: 'Passeig de la Muralla', blurb: 'Camino sobre las murallas con vistas a los tejados del Barri Vell.' },
      { name: 'Banys Àrabs', blurb: 'Baños públicos medievales inspirados en los baños andalusíes.' },
      { name: 'Pont de les Peixateries Velles', blurb: 'Puente de hierro rojo sobre el Onyar, salido del taller de Eiffel.' },
    ],
  },
  {
    slug: 'leon',
    name: 'León',
    region: 'Castilla y León',
    lat: 42.5995,
    lng: -5.5667, // Catedral
    intro:
      'León combina una catedral gótica de vidrieras deslumbrantes con un Barrio Húmedo lleno de bares de tapas. El casco antiguo, que aún conserva restos de su muralla romana, se recorre con facilidad a pie.',
    highlights: [
      { name: 'Catedral de León', blurb: 'La Pulchra Leonina, famosa por sus vidrieras medievales.' },
      { name: 'Real Colegiata de San Isidoro', blurb: 'Conjunto románico con el Panteón de los Reyes, la Capilla Sixtina del románico.' },
      { name: 'Casa Botines', blurb: 'El edificio neogótico de Gaudí en pleno centro.' },
      { name: 'Barrio Húmedo', blurb: 'Calles de bares en torno a la Plaza de San Martín, donde la tapa va con la bebida.' },
      { name: 'Plaza Mayor', blurb: 'Plaza porticada donde se sigue celebrando el mercado tradicional.' },
      { name: 'San Marcos', blurb: 'Antiguo hospital de peregrinos con una larga fachada plateresca junto al Bernesga.' },
    ],
  },
  {
    slug: 'burgos',
    name: 'Burgos',
    region: 'Castilla y León',
    lat: 42.3407,
    lng: -3.7046, // Catedral
    intro:
      'Burgos gira alrededor de su catedral, una de las grandes obras del gótico europeo, y del paseo junto al río Arlanzón. Parada obligada del Camino de Santiago, tiene un centro cómodo y fácil de caminar.',
    highlights: [
      { name: 'Catedral de Burgos', blurb: 'Joya gótica declarada Patrimonio de la Humanidad, donde está enterrado el Cid.' },
      { name: 'Arco de Santa María', blurb: 'La antigua puerta de la muralla que da paso a la catedral.' },
      { name: 'Paseo del Espolón', blurb: 'Paseo arbolado junto al Arlanzón, el más popular de la ciudad.' },
      { name: 'Plaza Mayor', blurb: 'Plaza porticada de forma irregular junto al ayuntamiento.' },
      { name: 'Mirador del Castillo', blurb: 'La catedral y los tejados vistos desde el cerro del castillo.' },
      { name: 'Museo de la Evolución Humana', blurb: 'Museo dedicado a los hallazgos de los yacimientos de Atapuerca.' },
    ],
  },
  {
    slug: 'oviedo',
    name: 'Oviedo',
    region: 'Asturias',
    lat: 43.3625,
    lng: -5.8433, // Catedral
    intro:
      'Oviedo tiene un casco antiguo peatonal y tranquilo, salpicado de esculturas y presidido por una catedral gótica. En sus alrededores esperan las iglesias del prerrománico asturiano, y en el centro, las sidrerías de la calle Gascona.',
    highlights: [
      { name: 'Catedral de San Salvador', blurb: 'Catedral gótica que guarda la Cámara Santa.' },
      { name: 'Plaza del Fontán', blurb: 'Plaza porticada junto al mercado del mismo nombre.' },
      { name: 'Calle Gascona', blurb: 'El bulevar de la sidra, con sidrerías una detrás de otra.' },
      { name: 'Campo de San Francisco', blurb: 'Gran parque en pleno centro, con paseos y estanques.' },
      { name: 'Santa María del Naranco', blurb: 'Palacio prerrománico en la ladera del Naranco, Patrimonio de la Humanidad.' },
      { name: 'Estatua de La Regenta', blurb: 'Escultura dedicada a la novela de Clarín, frente a la catedral.' },
    ],
  },
  {
    slug: 'cuenca',
    name: 'Cuenca',
    region: 'Castilla-La Mancha',
    lat: 40.0782,
    lng: -2.1300, // Plaza Mayor
    intro:
      'Cuenca se levanta sobre una hoz entre los ríos Júcar y Huécar, con casas que literalmente cuelgan sobre el vacío. Su casco antiguo, Patrimonio de la Humanidad, es una subida continua de calles estrechas hasta el barrio del Castillo.',
    highlights: [
      { name: 'Casas Colgadas', blurb: 'Casas sobre la hoz del Huécar, hoy sede del Museo de Arte Abstracto Español.' },
      { name: 'Puente de San Pablo', blurb: 'Puente de hierro con la mejor vista de las Casas Colgadas.' },
      { name: 'Catedral de Cuenca', blurb: 'Una de las primeras catedrales góticas de España, en la Plaza Mayor.' },
      { name: 'Plaza Mayor', blurb: 'Plaza irregular cerrada por el ayuntamiento y sus arcos sobre la calle.' },
      { name: 'Barrio del Castillo', blurb: 'La parte más alta del casco, con restos de muralla y miradores.' },
      { name: 'Torre de Mangana', blurb: 'Torre del reloj en una plaza con vistas sobre la ciudad baja.' },
    ],
  },
  {
    slug: 'avila',
    name: 'Ávila',
    region: 'Castilla y León',
    lat: 40.6564,
    lng: -4.7002, // Plaza del Mercado Chico
    intro:
      'Ávila está rodeada por una muralla medieval completa que en parte se puede recorrer por su adarve. Dentro y fuera de ella, la ciudad de Santa Teresa reúne iglesias románicas, conventos y miradores sobre la llanura.',
    highlights: [
      { name: 'Muralla de Ávila', blurb: 'Recinto medieval completo, con tramos de adarve abiertos al paseo.' },
      { name: 'Catedral de Ávila', blurb: 'Catedral fortaleza cuyo ábside forma parte de la propia muralla.' },
      { name: 'Basílica de San Vicente', blurb: 'Gran templo románico junto a la muralla.' },
      { name: 'Los Cuatro Postes', blurb: 'El humilladero desde el que se ve la ciudad amurallada entera.' },
      { name: 'Plaza del Mercado Chico', blurb: 'La plaza mayor del casco antiguo, con el ayuntamiento.' },
      { name: 'Convento de Santa Teresa', blurb: 'Levantado sobre la casa natal de la santa.' },
    ],
  },
  {
    slug: 'merida',
    name: 'Mérida',
    region: 'Extremadura',
    lat: 38.9164,
    lng: -6.3465, // Plaza de España
    intro:
      'Mérida, la antigua Augusta Emerita, conserva uno de los conjuntos arqueológicos romanos más completos de España, repartido por la ciudad de hoy. Teatro, anfiteatro, templos y puentes se enlazan en un mismo paseo a pie.',
    highlights: [
      { name: 'Teatro Romano', blurb: 'El gran teatro de Augusta Emerita, escenario del Festival de Teatro Clásico.' },
      { name: 'Anfiteatro', blurb: 'Junto al teatro, donde se celebraban los combates de gladiadores.' },
      { name: 'Templo de Diana', blurb: 'Templo romano en pleno centro, rodeado de edificios actuales.' },
      { name: 'Puente Romano', blurb: 'Uno de los puentes romanos más largos que se conservan, sobre el Guadiana.' },
      { name: 'Museo Nacional de Arte Romano', blurb: 'Edificio de Rafael Moneo con mosaicos y esculturas de la ciudad romana.' },
      { name: 'Alcazaba', blurb: 'Fortaleza andalusí junto al puente, levantada con material romano.' },
    ],
  },
  {
    slug: 'palma-de-mallorca',
    name: 'Palma de Mallorca',
    // Civitatis: /es/palma-mallorca/. Ours redirects to its homepage.
    civitatisSlug: 'palma-mallorca',
    region: 'Islas Baleares',
    lat: 39.5696,
    lng: 2.6501, // Plaça de Cort
    intro:
      'Palma mira al mar desde su catedral gótica, levantada junto a la muralla de la bahía. Detrás se abre un casco antiguo de patios señoriales, calles estrechas y plazas que se recorre a pie en una mañana.',
    highlights: [
      { name: 'Catedral de Mallorca', blurb: 'La Seu, catedral gótica frente al mar, con intervenciones de Gaudí.' },
      { name: 'Palacio de la Almudaina', blurb: 'Antigua alcazaba andalusí convertida en palacio real, junto a la catedral.' },
      { name: 'Castillo de Bellver', blurb: 'Castillo de planta circular con vistas sobre la bahía.' },
      { name: 'Plaza Mayor', blurb: 'Plaza porticada en el centro del casco antiguo.' },
      { name: 'Baños Árabes', blurb: 'Uno de los pocos restos de la Palma andalusí, con un pequeño jardín.' },
      { name: 'Paseo del Born', blurb: 'El paseo arbolado más elegante de la ciudad.' },
    ],
  },
  {
    slug: 'alicante',
    name: 'Alicante',
    region: 'Comunidad Valenciana',
    lat: 38.3454,
    lng: -0.4809, // Ayuntamiento
    intro:
      'Alicante es una ciudad mediterránea de paseo marítimo y playa urbana, vigilada desde lo alto por el castillo de Santa Bárbara. Entre el puerto y el monte Benacantil se esconde el barrio de Santa Cruz, de casas blancas y macetas.',
    highlights: [
      { name: 'Castillo de Santa Bárbara', blurb: 'Fortaleza sobre el monte Benacantil, con vistas a toda la bahía.' },
      { name: 'Explanada de España', blurb: 'Paseo de palmeras con su célebre suelo de teselas en forma de ondas.' },
      { name: 'Barrio de Santa Cruz', blurb: 'Barrio en cuesta de casas encaladas a los pies del castillo.' },
      { name: 'Playa del Postiguet', blurb: 'La playa urbana, a un paso del centro.' },
      { name: 'Basílica de Santa María', blurb: 'Iglesia levantada sobre la antigua mezquita, frente al museo MACA.' },
      { name: 'Mercado Central', blurb: 'Mercado modernista de abastos en pleno centro.' },
    ],
  },
  {
    slug: 'pamplona',
    name: 'Pamplona',
    region: 'Navarra',
    lat: 42.8168,
    lng: -1.6428, // Plaza del Castillo
    intro:
      'Pamplona es mucho más que San Fermín: un casco antiguo de calles estrechas y bares de pintxos que se recorre siguiendo el trazado del encierro. Sus murallas y su ciudadela forman uno de los conjuntos fortificados mejor conservados de España.',
    highlights: [
      { name: 'Plaza del Castillo', blurb: 'La plaza central de la ciudad, rodeada de cafés históricos.' },
      { name: 'Catedral de Santa María', blurb: 'Catedral con un claustro gótico de los más destacados de Europa.' },
      { name: 'Murallas de Pamplona', blurb: 'Baluartes y fosos que se recorren a pie alrededor del casco.' },
      { name: 'Ciudadela', blurb: 'Fortaleza en forma de estrella convertida en parque.' },
      { name: 'Calle Estafeta', blurb: 'El tramo más conocido del recorrido del encierro.' },
      { name: 'Ayuntamiento', blurb: 'Fachada barroca desde cuyo balcón se lanza el chupinazo.' },
    ],
  },
  {
    slug: 'valladolid',
    name: 'Valladolid',
    region: 'Castilla y León',
    lat: 41.6521,
    lng: -4.7285, // Plaza Mayor
    intro:
      'Valladolid fue sede de la corte y conserva de aquella época palacios, iglesias y una plaza mayor que sirvió de modelo a otras de España. Su centro peatonal se completa con el museo de escultura y el parque del Campo Grande.',
    highlights: [
      { name: 'Plaza Mayor', blurb: 'Plaza porticada que sirvió de modelo a otras plazas mayores de España.' },
      { name: 'Museo Nacional de Escultura', blurb: 'Imaginería castellana en el Colegio de San Gregorio, de fachada isabelina.' },
      { name: 'Catedral de Valladolid', blurb: 'Catedral inacabada proyectada por Juan de Herrera.' },
      { name: 'Iglesia de San Pablo', blurb: 'Fachada gótica de gran riqueza decorativa junto a San Gregorio.' },
      { name: 'Campo Grande', blurb: 'Parque romántico en el centro, con pavos reales sueltos.' },
      { name: 'Casa de Cervantes', blurb: 'La casa donde vivió el escritor, hoy museo.' },
    ],
  },
];

const CITY_BY_SLUG = Object.fromEntries(CITIES.map((c) => [c.slug, c]));

module.exports = { CITIES, CITY_BY_SLUG };
