/**
 * Formateo de referencias bibliográficas para material audiovisual.
 *
 * Se construye a partir de los metadatos reales de la ficha. Cuando falta el dato
 * (p. ej. director), se degrada con elegancia usando la entidad custodia como
 * autor institucional, que es la práctica habitual para archivos del Estado.
 */
const INSTITUTION = 'Archivo Estatal de Medios y Cultura';

function yearOf(movie) {
  if (movie.anio) return String(movie.anio);
  if (movie.releaseDate) {
    const y = String(movie.releaseDate).slice(0, 4);
    if (/^\d{4}$/.test(y)) return y;
  }
  return 's.f.'; // sin fecha
}

function producerOf(movie) {
  if (movie.productionCompany) return movie.productionCompany;
  if (movie.fondoEstatal && movie.fondoEstatal !== 'No Aplica') return movie.fondoEstatal;
  return INSTITUTION;
}

/** Referencia APA 7 para una obra audiovisual. */
function formatAPA(movie) {
  const title = movie.title || movie.name || 'Obra sin título';
  const year = yearOf(movie);
  const producer = producerOf(movie);
  const author = movie.director
    ? `${movie.director} (Director)`
    : INSTITUTION;
  return `${author}. (${year}). ${title} [Película]. ${producer}.`;
}

/** Referencia estilo Chicago (nota) para una obra audiovisual. */
function formatChicago(movie) {
  const title = movie.title || movie.name || 'Obra sin título';
  const year = yearOf(movie);
  const producer = producerOf(movie);
  const author = movie.director || INSTITUTION;
  return `${author}. ${title}. ${producer}, ${year}.`;
}

function buildReference(movie, format = 'APA') {
  return format === 'Chicago' ? formatChicago(movie) : formatAPA(movie);
}

module.exports = { buildReference, formatAPA, formatChicago };
