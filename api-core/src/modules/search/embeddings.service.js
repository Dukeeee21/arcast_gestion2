/**
 * Búsqueda semántica REAL basada en embeddings (vectores) de Gemini.
 *
 * A diferencia del enfoque anterior (que solo extraía palabras clave y hacía un
 * `regex` literal contra título/sinopsis), aquí sí se "leen" las descripciones:
 * de cada título del catálogo se genera un vector con su título + géneros +
 * país + sinopsis, y en cada búsqueda se compara el vector de la consulta contra
 * los del catálogo por similitud coseno. Así "un drama peruano en la sierra"
 * encuentra "Wiñaypacha" aunque no compartan ninguna palabra exacta.
 */
const { GoogleGenAI } = require('@google/genai');
const Movie = require('../catalog/movie.model');
const TVShow = require('../catalog/tvshow.model');

const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || 'gemini-embedding-001';

let _ai = null;
function getAI() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY no está configurada en las variables de entorno');
    if (!_ai) _ai = new GoogleGenAI({ apiKey });
    return _ai;
}

// Texto representativo de un título para generar su embedding. Incluimos género
// y país para que la semántica capture cosas como "peruano" o "comedia".
function buildText(doc) {
    const title = doc.title || doc.name || '';
    const genres = Array.isArray(doc.genres) ? doc.genres.join(', ') : '';
    const country = Array.isArray(doc.originCountry) ? doc.originCountry.join(', ') : '';
    const overview = doc.overview || '';
    return [title, genres, country, overview].filter(Boolean).join('. ').trim();
}

async function embedText(text) {
    const ai = getAI();
    const res = await ai.models.embedContent({ model: EMBED_MODEL, contents: text });
    const values = res && res.embeddings && res.embeddings[0] && res.embeddings[0].values;
    if (!Array.isArray(values) || !values.length) throw new Error('La API devolvió un embedding vacío');
    return values;
}

function cosineSimilarity(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    if (!na || !nb) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Genera/actualiza los embeddings de todo el catálogo. Idempotente: solo procesa
 * títulos cuyo texto cambió o que aún no tienen vector (a menos que `force`).
 * `log` permite silenciar la salida cuando corre desde el arranque automático.
 */
async function ensureCatalogEmbeddings({ log = console.log, force = false } = {}) {
    const models = [Movie, TVShow];
    let processed = 0, skipped = 0, failed = 0;

    for (const Model of models) {
        const docs = await Model.find()
            .select('+embedding +embeddingText title name overview genres originCountry');

        for (const doc of docs) {
            const text = buildText(doc);
            if (!text) { skipped++; continue; }

            const upToDate = doc.embedding && doc.embedding.length && doc.embeddingText === text;
            if (!force && upToDate) { skipped++; continue; }

            try {
                doc.embedding = await embedText(text);
                doc.embeddingText = text;
                await doc.save();
                processed++;
            } catch (e) {
                failed++;
                log(`!  embedding falló para "${doc.title || doc.name}": ${e.message}`);
            }
            await sleep(120); // no saturar la API de embeddings
        }
    }

    return { processed, skipped, failed };
}

module.exports = { getAI, buildText, embedText, cosineSimilarity, ensureCatalogEmbeddings, EMBED_MODEL };
