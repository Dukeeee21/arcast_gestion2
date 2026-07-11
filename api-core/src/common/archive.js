/**
 * Utilidades para buscar en archive.org una fuente de video REPRODUCIBLE para
 * un título dado, validando que:
 *   1) el ítem tenga un archivo de video real (metadata.files), y
 *   2) el título/año coincidan razonablemente (para no traer basura como
 *      partidos de fútbol o canciones que comparten una palabra del título).
 */
const axios = require('axios');

const VIDEO = /\.(mp4|m4v|webm|ogv)$/i;

// Relevancia mínima de título para aceptar un ítem de archive.org. Se puede
// aflojar/apretar por entorno sin tocar código. 0.6 = al menos el 60% de las
// palabras significativas del título deben aparecer.
const MIN_RELEVANCE = Number(process.env.ARCHIVE_MATCH_MIN_RELEVANCE || 0.6);
// Cuántos candidatos pedir por título (más = más chance de encontrar fuente).
const SEARCH_ROWS = Number(process.env.ARCHIVE_MATCH_ROWS || 12);

function normalize(s) {
    return (s || '')
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Proporción de palabras significativas del título del film presentes en el
// título del ítem de archive.
function relevance(filmTitle, archiveTitle) {
    const words = normalize(filmTitle).split(' ').filter((w) => w.length > 2);
    if (!words.length) return 0;
    const hay = normalize(archiveTitle);
    const hits = words.filter((w) => hay.includes(w)).length;
    return hits / words.length;
}

function significantWordCount(title) {
    return normalize(title).split(' ').filter((w) => w.length > 2).length;
}

function extractYear(str) {
    const m = String(str || '').match(/\b(19\d{2}|20\d{2})\b/);
    return m ? Number(m[1]) : null;
}

async function search(title) {
    const url = 'https://archive.org/advancedsearch.php';
    const { data } = await axios.get(url, {
        params: {
            q: `title:(${title}) AND mediatype:(movies)`,
            'fl[]': ['identifier', 'title', 'year'],
            rows: SEARCH_ROWS,
            output: 'json',
        },
        timeout: 15000,
    });
    return (data && data.response && data.response.docs) || [];
}

async function validate(identifier) {
    const { data } = await axios.get(`https://archive.org/metadata/${identifier}`, { timeout: 15000 });
    if (!data || data.error || !Array.isArray(data.files)) return null;
    const vids = data.files.filter((f) => VIDEO.test(f.name || ''));
    if (!vids.length) return null;
    vids.sort((a, b) => Number(b.size || 0) - Number(a.size || 0));
    return `https://archive.org/download/${identifier}/${encodeURIComponent(vids[0].name)}`;
}

/**
 * Devuelve una URL de video directa reproducible o null.
 * Reglas anti-basura:
 *  - relevancia de título >= MIN_RELEVANCE (0.6 por defecto)
 *  - si hay año: el año del ítem debe estar a ±1; si el ítem no expone año,
 *    se exige que el año aparezca en su título.
 *  - si el título del film es de una sola palabra significativa, se exige año.
 */
async function findPlayableSource(title, year) {
    const docs = await search(title);
    const oneWord = significantWordCount(title) <= 1;

    for (const d of docs) {
        const rel = relevance(title, d.title);
        if (rel < MIN_RELEVANCE) continue;

        const docYear = d.year ? Number(d.year) : extractYear(d.title);

        if (year) {
            if (!docYear) continue;                 // sin año no arriesgamos
            if (Math.abs(docYear - Number(year)) > 1) continue;
        } else if (oneWord) {
            continue;                               // 1 palabra y sin año -> demasiado riesgo
        }

        const url = await validate(d.identifier);
        if (url) return { url, identifier: d.identifier, matchedTitle: d.title, matchedYear: docYear };
    }
    return null;
}

module.exports = { findPlayableSource, relevance, validate, search };
