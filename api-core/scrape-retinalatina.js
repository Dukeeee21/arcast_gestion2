/**
 * scrape-retinalatina.js
 * Importa las películas peruanas de Retina Latina (API AJAX catalogofilter).
 *
 * Uso:
 *   node scrape-retinalatina.js              # dry-run
 *   node scrape-retinalatina.js --apply      # guarda en BD
 */
require('dotenv').config();
const axios    = require('axios');
const mongoose = require('mongoose');
const Movie    = require('./src/modules/catalog/movie.model');

const APPLY   = process.argv.includes('--apply');
const BASE    = 'https://www.retinalatina.org';
const AJAX    = `${BASE}/wp-admin/admin-ajax.php?action=catalogofilter`;
const HDRJSON = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
                  'Content-Type': 'application/json' };
const HDRGET  = { 'User-Agent': HDRJSON['User-Agent'] };
const KEY     = process.env.TMDB_API_KEY;
const IMG     = 'https://image.tmdb.org/t/p/w500';
const BACK    = 'https://image.tmdb.org/t/p/original';
const sleep   = ms => new Promise(r => setTimeout(r, ms));

/** Llama a la API y devuelve {registros, html} */
async function callAPI(pais, page) {
    const r = await axios.post(AJAX, { pais, genero: '', duracion: '', page },
        { headers: HDRJSON, responseType: 'text' });
    const raw = r.data;
    // La respuesta tiene espacios antes del JSON — buscamos el primer '{'
    const jsonStart = raw.indexOf('{');
    if (jsonStart === -1) return null;
    const parsed = JSON.parse(raw.slice(jsonStart));
    const registros = parsed?.datos?.registros ?? 0;
    const html      = parsed?.datos?.datos ?? '';
    return { registros, html };
}

/** Extrae todos los links de películas paginando */
async function getAllLinks() {
    const allLinks = new Set();
    let page = 1;
    const { registros, html: firstHtml } = await callAPI('PERÚ', 1) ?? {};
    if (!registros) return [];

    console.log(`Total registros en Retina Latina Perú: ${registros}`);
    const extract = html => [...html.matchAll(/href="(https?:\/\/www\.retinalatina\.org\/peliculas\/[^"]+)"/g)]
        .map(m => m[1]);

    extract(firstHtml).forEach(l => allLinks.add(l));
    console.log(`  Página 1: ${extract(firstHtml).length} links`);

    // Estima cuántas páginas hay (el API devuelve ~10 por página)
    const perPage = extract(firstHtml).length || 10;
    const totalPages = Math.ceil(registros / perPage);

    for (page = 2; page <= totalPages + 2; page++) {
        const res = await callAPI('PERÚ', page);
        if (!res?.html) break;
        const links = extract(res.html);
        if (!links.length) break;
        links.forEach(l => allLinks.add(l));
        console.log(`  Página ${page}: ${links.length} links (total: ${allLinks.size})`);
        await sleep(600);
    }
    return [...allLinks];
}

/** Extrae título, poster y embed de una página de película */
async function getMovieData(pageUrl) {
    const r = await axios.get(pageUrl, { headers: HDRGET });
    const html = r.data;
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const title = titleMatch ? titleMatch[1].trim()
        : pageUrl.split('/peliculas/')[1]?.replace(/\/$/, '').replace(/-/g, ' ');
    const ogImg = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)
        || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
    const poster = ogImg ? ogImg[1] : null;
    const embedMatch =
        html.match(/src="(https?:\/\/player\.instantvideocloud\.net[^"]+)"/i) ||
        html.match(/src="(https?:\/\/player\.vimeo\.com\/video\/\d+[^"]*)"/) ||
        html.match(/src="(https?:\/\/www\.youtube\.com\/embed\/[^"]+)"/);
    return { title, poster, embedUrl: embedMatch ? embedMatch[1] : null };
}

async function findTMDB(title) {
    try {
        const r = await axios.get('https://api.themoviedb.org/3/search/movie',
            { params: { api_key: KEY, query: title, language: 'es-ES' } });
        return r.data.results.find(m => m.poster_path) || r.data.results[0] || null;
    } catch { return null; }
}

async function getTMDBDetail(id) {
    const r = await axios.get(`https://api.themoviedb.org/3/movie/${id}`,
        { params: { api_key: KEY, language: 'es-ES', append_to_response: 'videos' } });
    return r.data;
}

async function main() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ReelScoreDB');
    console.log(`MongoDB conectado [${APPLY ? 'APPLY' : 'DRY-RUN'}]\n`);

    const links = await getAllLinks();
    console.log(`\n${'─'.repeat(70)}\nPelículas a procesar: ${links.length}\n`);

    if (!links.length) {
        console.log('No se encontraron links.'); await mongoose.disconnect(); return;
    }

    let added = 0, updated = 0, noEmbed = 0, errors = 0;

    for (const pageUrl of links) {
        try {
            const { title, poster, embedUrl } = await getMovieData(pageUrl);
            if (!embedUrl) {
                console.log(`⚠  Sin embed: "${title}"`); noEmbed++; await sleep(300); continue;
            }

            // Ya existe con ese embed
            const byEmbed = await Movie.findOne({ watchLink: embedUrl });
            if (byEmbed) {
                console.log(`•  Ya existe: "${byEmbed.title}"`); updated++; await sleep(200); continue;
            }

            const tmdbBasic = await findTMDB(title); await sleep(200);
            let movieData;

            if (tmdbBasic?.id) {
                const byTmdb = await Movie.findOne({ tmdbId: tmdbBasic.id });
                if (byTmdb) {
                    console.log(`↺  Actualiza watchLink: "${byTmdb.title}"`);
                    if (APPLY) await Movie.updateOne({ _id: byTmdb._id }, { watchLink: embedUrl });
                    updated++; await sleep(300); continue;
                }
                const d = await getTMDBDetail(tmdbBasic.id).catch(() => null); await sleep(200);
                if (d) {
                    const trailer = (d.videos?.results||[]).find(v => v.type==='Trailer' && v.site==='YouTube');
                    movieData = {
                        title: d.title||title, overview: d.overview||'',
                        posterUrl: d.poster_path ? IMG+d.poster_path : poster,
                        backdropUrl: d.backdrop_path ? BACK+d.backdrop_path : null,
                        tmdbId: d.id, releaseDate: d.release_date, voteAverage: d.vote_average||0,
                        genres: (d.genres||[]).map(g=>g.name), trailerKey: trailer?.key||null,
                        duration: d.runtime||null, languages: (d.spoken_languages||[]).map(l=>l.name),
                        originCountry: ['PE'], watchLink: embedUrl,
                    };
                }
            }

            if (!movieData) {
                movieData = { title, overview:'', posterUrl: poster, backdropUrl: null,
                    originCountry:['PE'], watchLink: embedUrl, voteAverage: 0 };
            }

            const icon = movieData.posterUrl ? '🖼' : '⚠';
            console.log(`+  ${icon} "${movieData.title}" ${movieData.tmdbId?'(TMDB ✓)':'(solo Retina Latina)'}`);
            if (APPLY) await new Movie(movieData).save().catch(e => console.log(`   Guardado fallido: ${e.message}`));
            added++; await sleep(400);
        } catch (e) {
            console.log(`✗  ${pageUrl}: ${e.message}`); errors++;
        }
    }

    console.log(`\n${'─'.repeat(70)}`);
    console.log(`Nuevas:       ${added}`);
    console.log(`Actualizadas: ${updated}`);
    console.log(`Sin embed:    ${noEmbed}`);
    console.log(`Errores:      ${errors}`);
    if (!APPLY) console.log('\nEjecuta con --apply para guardar en la BD.');
    await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
