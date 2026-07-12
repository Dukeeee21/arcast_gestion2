/**
 * Formateo de referencias bibliográficas para material audiovisual.
 *
 * Se construye a partir de los metadatos reales de la ficha. Cuando falta el dato
 * (p. ej. director), se degrada con elegancia usando la entidad custodia como
 * autor institucional, que es la práctica habitual para archivos del Estado.
 */
const INSTITUTION = 'Archivo Estatal de Medios y Cultura';

// Partículas que van pegadas al apellido en nombres hispanos ("de la Cruz", "del Pino").
const SURNAME_PARTICLES = new Set(['de', 'del', 'la', 'los', 'las', 'van', 'von', 'da', 'di', 'do']);

/**
 * Separa un nombre en formato libre ("Javier Fuentes-León") en { given, surname }.
 * Sin campos estructurados de nombre/apellido en la BD, se asume que la última
 * palabra (más las partículas que la preceden) es el apellido — la misma
 * simplificación que usan la mayoría de gestores de citas sin nombre estructurado.
 */
function splitName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { given: '', surname: parts[0] };
  let splitIdx = parts.length - 1;
  while (splitIdx > 0 && SURNAME_PARTICLES.has(parts[splitIdx - 1].toLowerCase())) {
    splitIdx--;
  }
  return { given: parts.slice(0, splitIdx).join(' '), surname: parts.slice(splitIdx).join(' ') };
}

/** "Javier" -> "J.", "J." -> "J." (ya es inicial, se deja tal cual). */
function toInitials(given) {
  if (!given) return '';
  return given.split(/\s+/).map((w) => (/^[A-ZÁÉÍÓÚÑ]\.$/.test(w) ? w : `${w[0].toUpperCase()}.`)).join(' ');
}

/** "Javier Fuentes-León" -> "Fuentes-León, Javier" (nombre completo, para Chicago). */
function invertNameFull(fullName) {
  const { given, surname } = splitName(fullName);
  return given ? `${surname}, ${given}` : surname;
}

/** "Javier Fuentes-León" -> "Fuentes-León, J." (con iniciales, para APA). */
function invertNameInitials(fullName) {
  const { given, surname } = splitName(fullName);
  const initials = toInitials(given);
  return initials ? `${surname}, ${initials}` : surname;
}

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
    ? `${invertNameInitials(movie.director)} (Director)`
    : INSTITUTION;
  return `${author}. (${year}). ${title} [Película]. ${producer}.`;
}

/** Referencia estilo Chicago (nota) para una obra audiovisual. */
function formatChicago(movie) {
  const title = movie.title || movie.name || 'Obra sin título';
  const year = yearOf(movie);
  const producer = producerOf(movie);
  const author = movie.director ? `${invertNameFull(movie.director)}, dir` : INSTITUTION;
  return `${author}. ${title}. ${producer}, ${year}.`;
}

function buildReference(movie, format = 'APA') {
  return format === 'Chicago' ? formatChicago(movie) : formatAPA(movie);
}

module.exports = { buildReference, formatAPA, formatChicago };
