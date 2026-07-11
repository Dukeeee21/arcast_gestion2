/**
 * Matcher automático: recorre las películas del catálogo que NO tienen una
 * fuente reproducible y busca una en archive.org, validando título + año para
 * no asignar enlaces basura. Solo escribe `watchLink` cuando encuentra un video
 * real. Es idempotente y no destructivo.
 *
 * Uso:
 *   docker-compose exec api-core node match-archive.js            # todo el catálogo
 *   docker-compose exec api-core node match-archive.js --limit 30 # solo 30
 *   docker-compose exec api-core node match-archive.js --dry      # sin guardar
 */
const mongoose = require('mongoose');
require('dotenv').config();

/** @type {any} */
const Movie = require('./src/modules/catalog/movie.model');
const { findPlayableSource } = require('./src/common/archive');

const isHttp = (u) => typeof u === 'string' && /^https?:\/\//i.test((u || '').trim());
const isDirectVideo = (u) =>
    typeof u === 'string' && (/\.(mp4|m4v|webm|ogv|mkv|mov|avi)(\?.*)?$/i.test((u || '').trim())
        || /archive\.org\/(download|serve)\//i.test(u || ''));

// Ya tiene fuente reproducible si hay archivo local o URL de video directa.
function hasPlayableSource(m) {
    if (m.localPath && !isHttp(m.localPath)) return true;         // archivo local
    if (isDirectVideo(m.localPath)) return true;                  // URL directa en localPath
    if (isDirectVideo(m.watchLink)) return true;                  // URL directa en watchLink
    return false;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Recorre el catálogo y rellena fuentes desde archive.org. Asume conexión abierta.
// `log` permite silenciar la salida cuando corre desde el arranque automático.
async function matchArchive({ limit = Infinity, dry = false, log = console.log } = {}) {
    const movies = await Movie.find().select('title releaseDate localPath watchLink originCountry');
    const pending = movies.filter((m) => !hasPlayableSource(m)).slice(0, limit);

    log(`Catálogo: ${movies.length} películas. Sin fuente reproducible: ${pending.length}${dry ? ' (dry-run)' : ''}.`);
    let matched = 0;

    for (const m of pending) {
        const year = (m.releaseDate || '').slice(0, 4);
        let hit = null;
        try {
            hit = await findPlayableSource(m.title, year || null);
        } catch (e) {
            log(`!  "${m.title}" error de red: ${e.message}`);
        }

        if (hit) {
            matched++;
            log(`OK  "${m.title}" -> ${hit.matchedTitle} [${hit.matchedYear || '?'}]`);
            if (!dry) {
                m.watchLink = hit.url;
                if (!m.originCountry || m.originCountry.length === 0) m.originCountry = ['PE'];
                await m.save();
            }
        }
        await sleep(400); // no saturar la API de archive.org
    }

    return { pending: pending.length, matched };
}

module.exports = { matchArchive };

if (require.main === module) {
    (async () => {
        const args = process.argv.slice(2);
        const dry = args.includes('--dry');
        const limIdx = args.indexOf('--limit');
        const limit = limIdx >= 0 ? Number(args[limIdx + 1]) : Infinity;

        await mongoose.connect(process.env.MONGO_URI);
        const { pending, matched } = await matchArchive({ limit, dry });
        console.log(`\nHecho. Coincidencias reproducibles encontradas: ${matched} de ${pending}.`);
        await mongoose.disconnect();
        process.exit(0);
    })().catch((err) => {
        console.error('Error en match-archive:', err.message);
        process.exit(1);
    });
}
