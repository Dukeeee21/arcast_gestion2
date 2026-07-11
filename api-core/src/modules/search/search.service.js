const { GoogleGenAI } = require('@google/genai');
const Movie = require('../catalog/movie.model');
const TVShow = require('../catalog/tvshow.model');
const { embedText, cosineSimilarity } = require('./embeddings.service');

// Umbral de similitud coseno para considerar un título "relevante", y tope de
// resultados. Ajustables por entorno sin tocar código.
const MIN_SIMILARITY = Number(process.env.SEMANTIC_MIN_SIMILARITY || 0.55);
const MAX_RESULTS = Number(process.env.SEMANTIC_MAX_RESULTS || 24);

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Mapa de países comunes a códigos ISO de 2 letras (para los chips y el fallback).
const COUNTRY_MAP = {
    peru: 'PE', 'perú': 'PE', peruano: 'PE', peruana: 'PE',
    'españa': 'ES', 'español': 'ES', 'española': 'ES',
    'estados unidos': 'US', eeuu: 'US', usa: 'US',
    argentina: 'AR', argentino: 'AR',
    mexico: 'MX', 'méxico': 'MX',
    chile: 'CL', chileno: 'CL',
    colombia: 'CO', colombiano: 'CO',
    venezuela: 'VE', bolivia: 'BO', ecuador: 'EC',
};

/**
 * Usa Gemini para interpretar la consulta y extraer palabras clave / género /
 * país. Sirve solo para los chips "La IA entendió" de la UI; el ranking real lo
 * hacen los embeddings. Si falla, devolvemos una interpretación vacía.
 */
const interpretQuery = async (queryText) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { keywords: [], genres: [], country: [] };

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Analiza la siguiente consulta de búsqueda para un catálogo de películas y series: "${queryText}".
Extrae los términos de búsqueda clave, géneros cinematográficos o países mencionados. Para los países, intenta usar su código de 2 letras ISO 3166-1 (por ejemplo: "Perú" -> "PE", "España" -> "ES", "Estados Unidos" -> "US").

CRITICAL: Ignora frases conversacionales o intenciones de visualización que no aporten al filtro directo de contenido (por ejemplo: "para ver con amigos", "recomendaciones de", "quiero ver", "algo para", "que sea", "buena película"). Solo extrae palabras clave reales que describan el tema o argumento (por ejemplo: "fantasmas", "vampiros", "espacio", "secuestro").

Devuelve ÚNICAMENTE un objeto JSON (sin texto adicional ni formato markdown como bloques \`\`\`) con la siguiente estructura:
{
  "keywords": ["termino1", "termino2"],
  "genres": ["genero1"],
  "country": ["código_país_2_letras"]
}
Si no encuentras algún dato para una categoría, devuelve un array vacío. Trata de deducir el país y el género correctamente (ej: "peruano" -> "PE").`;

    try {
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        let text = (response.text || '').replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(text);
        const country = (data.country || []).map((c) => {
            const key = String(c).toLowerCase().trim();
            return COUNTRY_MAP[key] || String(c).toUpperCase();
        });
        return { keywords: data.keywords || [], genres: data.genres || [], country };
    } catch (e) {
        console.error('Interpretación semántica (no crítica) falló:', e.message);
        return { keywords: [], genres: [], country: [] };
    }
};

// Quita el vector antes de enviar el resultado al cliente (es grande e inútil ahí).
const strip = (doc, mediaType, score) => {
    const { embedding, embeddingText, ...rest } = doc;
    return { ...rest, mediaType, _score: Number(score.toFixed(4)) };
};

/**
 * Fallback por palabras clave (OR permisivo) para cuando el catálogo todavía no
 * tiene embeddings generados. Busca en título/nombre/sinopsis/géneros/país.
 */
const keywordFallback = async (interpretation) => {
    const { keywords = [], genres = [], country = [] } = interpretation;
    const terms = [...keywords, ...genres].filter(Boolean);
    const or = [];

    if (terms.length) {
        const rx = terms.map((t) => new RegExp(escapeRegex(t), 'i'));
        or.push({ title: { $in: rx } }, { name: { $in: rx } }, { overview: { $in: rx } }, { genres: { $in: rx } });
    }
    if (country.length) {
        const crx = country.map((c) => new RegExp(escapeRegex(c), 'i'));
        or.push({ originCountry: { $in: crx } });
    }
    if (!or.length) return [];

    const query = { $or: or };
    const [movies, tvShows] = await Promise.all([Movie.find(query).lean(), TVShow.find(query).lean()]);
    return [
        ...movies.map((m) => ({ ...m, mediaType: 'movie' })),
        ...tvShows.map((t) => ({ ...t, mediaType: 'tv' })),
    ];
};

const performSemanticSearch = async (queryText) => {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY no está configurada en las variables de entorno');
    }

    // 1. Interpretación para los chips (no bloquea la búsqueda si falla).
    const interpretation = await interpretQuery(queryText);

    // 2. Embedding de la consulta.
    let queryVec;
    try {
        queryVec = await embedText(queryText);
    } catch (e) {
        // Sin poder generar el vector de la consulta → intentamos por palabras.
        return { interpretation, results: await keywordFallback(interpretation), mode: 'keyword' };
    }

    // 3. Traer solo títulos que ya tengan embedding y rankear por similitud.
    const [movies, tvShows] = await Promise.all([
        Movie.find({ embedding: { $exists: true, $ne: [] } }).select('+embedding').lean(),
        TVShow.find({ embedding: { $exists: true, $ne: [] } }).select('+embedding').lean(),
    ]);

    // Catálogo aún sin embeddings (primer arranque): caemos al filtro por palabras.
    if (movies.length === 0 && tvShows.length === 0) {
        return { interpretation, results: await keywordFallback(interpretation), mode: 'keyword' };
    }

    const scored = [];
    for (const m of movies) {
        const score = cosineSimilarity(queryVec, m.embedding);
        if (score >= MIN_SIMILARITY) scored.push(strip(m, 'movie', score));
    }
    for (const t of tvShows) {
        const score = cosineSimilarity(queryVec, t.embedding);
        if (score >= MIN_SIMILARITY) scored.push(strip(t, 'tv', score));
    }

    scored.sort((a, b) => b._score - a._score);

    return { interpretation, results: scored.slice(0, MAX_RESULTS), mode: 'semantic' };
};

module.exports = { performSemanticSearch, interpretQuery };
