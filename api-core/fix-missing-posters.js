/**
 * fix-missing-posters.js
 *
 * Busca todas las películas y series sin posterUrl (o con poster roto)
 * y los rellena consultando TMDB por su tmdbId.
 *
 * Uso:
 *   node fix-missing-posters.js              # dry-run (solo muestra qué actualizaría)
 *   node fix-missing-posters.js --apply      # aplica los cambios a la BD
 */
require('dotenv').config();
const axios    = require('axios');
const mongoose = require('mongoose');
const Movie    = require('./src/modules/catalog/movie.model');
const TVShow   = require('./src/modules/catalog/tvshow.model');

const TMDB_KEY    = process.env.TMDB_API_KEY;
const TMDB_IMG    = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACK   = 'https://image.tmdb.org/t/p/original';
const APPLY       = process.argv.includes('--apply');
const sleep = ms  => new Promise(r => setTimeout(r, ms));

if (!TMDB_KEY) { console.error('Falta TMDB_API_KEY en .env'); process.exit(1); }

async function getBestImage(type, tmdbId) {
    // 1) Intenta con es-ES
    const main = await axios.get(`https://api.themoviedb.org/3/${type}/${tmdbId}`, {
        params: { api_key: TMDB_KEY, language: 'es-ES' }
    });
    const d = main.data;
    if (d.poster_path) return {
        posterUrl:   `${TMDB_IMG}${d.poster_path}`,
        backdropUrl: d.backdrop_path ? `${TMDB_BACK}${d.backdrop_path}` : null,
    };

    // 2) Si no hay poster en es-ES, busca en todas las imágenes disponibles (sin filtro de idioma)
    const imgs = await axios.get(`https://api.themoviedb.org/3/${type}/${tmdbId}/images`, {
        params: { api_key: TMDB_KEY }
    });
    const posters   = imgs.data.posters   || [];
    const backdrops = imgs.data.backdrops || [];
    const poster   = posters[0]?.file_path   ? `${TMDB_IMG}${posters[0].file_path}`     : null;
    const backdrop = backdrops[0]?.file_path ? `${TMDB_BACK}${backdrops[0].file_path}`  : null;
    return { posterUrl: poster, backdropUrl: backdrop || (d.backdrop_path ? `${TMDB_BACK}${d.backdrop_path}` : null) };
}

async function fetchMoviePoster(tmdbId) { return getBestImage('movie', tmdbId); }
async function fetchTVPoster(tmdbId)    { return getBestImage('tv',    tmdbId); }

async function fixCollection(Model, fetchFn, label) {
    const docs = await Model.find({
        tmdbId: { $exists: true, $ne: null },
        $or: [
            { posterUrl: { $exists: false } },
            { posterUrl: null },
            { posterUrl: '' },
        ]
    }).select('title name tmdbId posterUrl').lean();

    console.log(`\n[${label}] ${docs.length} sin poster`);
    if (!docs.length) return { updated: 0, failed: 0, noData: 0 };

    let updated = 0, failed = 0, noData = 0;

    for (const doc of docs) {
        const name = doc.title || doc.name;
        try {
            const data = await fetchFn(doc.tmdbId);
            if (!data.posterUrl) {
                console.log(`  ⚠  Sin imagen en TMDB: "${name}" (tmdbId=${doc.tmdbId})`);
                noData++;
            } else {
                if (APPLY) {
                    await Model.updateOne({ _id: doc._id }, { posterUrl: data.posterUrl, backdropUrl: data.backdropUrl });
                }
                const tag = APPLY ? '✅ actualizado' : '🔍 encontrado (--apply para guardar)';
                console.log(`  ${tag}: "${name}" → ${data.posterUrl}`);
                updated++;
            }
        } catch (e) {
            const status = e?.response?.status;
            if (status === 404) {
                console.log(`  ✗  No encontrado en TMDB: "${name}" (tmdbId=${doc.tmdbId})`);
            } else {
                console.log(`  ✗  Error para "${name}": ${e.message}`);
            }
            failed++;
        }
        await sleep(150); // evitar rate-limit de TMDB
    }

    return { updated, failed, noData };
}

async function main() {
    console.log(`Modo: ${APPLY ? 'APPLY (escribe en BD)' : 'DRY-RUN (solo lectura)'}`);
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ReelScoreDB');
    console.log('Conectado a MongoDB');

    const movieStats  = await fixCollection(Movie,  fetchMoviePoster, 'Películas');
    const tvStats     = await fixCollection(TVShow,  fetchTVPoster,    'Series');

    const total = { updated: movieStats.updated + tvStats.updated, failed: movieStats.failed + tvStats.failed, noData: movieStats.noData + tvStats.noData };
    console.log('\n' + '─'.repeat(60));
    console.log(`Encontrados con poster:  ${total.updated}`);
    console.log(`Sin imagen en TMDB:      ${total.noData}`);
    console.log(`Errores / no en TMDB:    ${total.failed}`);
    if (!APPLY && total.updated > 0) {
        console.log('\nEjecuta con --apply para guardar los cambios en la BD.');
    }

    await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
