const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();

/** @type {any} */
const Movie = require('./src/modules/catalog/movie.model');
/** @type {any} */
const TVShow = require('./src/modules/catalog/tvshow.model');

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMG_URL = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP_URL = 'https://image.tmdb.org/t/p/original';

// Solo definimos cuántas páginas queremos, quitamos los géneros hardcodeados
const PAGES_TO_FETCH = 12;

// Películas excluidas: videos incorrectos, no peruanas (TMDB las etiqueta mal)
// o contenido no representativo
const MOVIE_BLACKLIST = new Set([
    1517472, // Astronauta (video incorrecto)
    1578060, // BIGHEAD (video incorrecto)
    65120,   // Días de Santiago (video incorrecto)
    1701724, // Involucrados (video incorrecto)
    1156402, // ¿Quién es? (video incorrecto)
    1702120, // The Lyosacks (no peruana)
    1478178, // Los bárbaros (no peruana)
    450314,  // Condorito: la película (chilena)
    321497,  // La deuda / The Debt (coproducción extranjera)
    1494577, // Xhizito - Reflexiones Torcidas (no representativa)
    1262160, // The Male Gaze: Boy Trouble (no peruana)
    1023384, // Space Guns (no peruana)
    862598,  // Historia secreta (no peruana)
    1714703, // Los Esenciales 2
    1714738, // Los Esenciales
]);

// Series excluidas: no peruanas (TMDB las etiqueta mal) o no representativas
const TVSHOW_BLACKLIST = new Set([
    321622, // Hermanos Coraje
    218694, // Simplemente María
    108528, // Leonela, muriendo de amor
    202706, // Los Barriga
    283767, // ROCHE PE
    219004, // Little Angel
    231596, // Saint Seiya Tekai Hen Zeus (anime japonés)
    212428, // Taxista ra ra
    218699, // Gamboa
    251646, // Masacre de los Mormones
    313381, // Rainbow Hunters
    294644, // Ciudad Jardín
    212811, // LID
]);

// --- HELPERS (Se mantienen iguales) ---
const findTrailer = (videos) => {
    if (!videos || !videos.results) return null;
    // noinspection JSUnresolvedVariable
    let v = videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
    // noinspection JSUnresolvedVariable
    if (!v) v = videos.results.find(v => v.type === 'Teaser' && v.site === 'YouTube');
    // noinspection JSUnresolvedVariable
    if (!v) v = videos.results.find(v => v.site === 'YouTube');
    return v ? v.key : null;
};

const isInTheaters = (releaseDateStr) => {
    if (!releaseDateStr) return false;
    const release = new Date(releaseDateStr);
    const now = new Date();
    const diffDays = Math.ceil(Math.abs(now.getTime() - release.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 60;
};

const getWatchProviders = (providers, releaseDate) => {
    let results = [];
    // noinspection JSUnresolvedVariable
    if (providers && providers.results && providers.results.PE && providers.results.PE.flatrate) {
        // noinspection JSUnresolvedVariable
        results = providers.results.PE.flatrate.map(p => ({
            name: p.provider_name,
            logo: `${TMDB_IMG_URL}${p.logo_path}`,
            link: providers.results.PE.link
        }));
    }
    if (results.length === 0 && isInTheaters(releaseDate)) {
        results.push({
            name: 'Cineplanet / Cinemark',
            logo: 'https://img.icons8.com/color/48/cinema-.png',
            link: 'https://www.cineplanet.com.pe/'
        });
    }
    return results;
};

// --- IMPORTACIÓN ESTRICTA DE PERÚ ---

async function importPeruvianMovies() {
    try {
        console.log('\n🎬 Importando Películas Peruanas...');
        for (let page = 1; page <= PAGES_TO_FETCH; page++) {
            const response = await axios.get(`${TMDB_BASE_URL}/discover/movie`, {
                params: {
                    api_key: TMDB_API_KEY,
                    language: 'es-ES',
                    include_adult: 'false',
                    with_origin_country: 'PE', // <-- FILTRO DE PAÍS PE
                    sort_by: 'popularity.desc',
                    page: page
                }
            });

            for (const basicData of response.data.results) {
                // Ignorar entradas sin poster (evita importar películas sin imagen)
                if (!basicData.poster_path) { process.stdout.write('_'); continue; }
                if (MOVIE_BLACKLIST.has(basicData.id)) { process.stdout.write('⊘'); continue; }
                // noinspection JSUnresolvedFunction
                const existing = await Movie.findOne({ tmdbId: basicData.id });
                if (!existing) {
                    try {
                        const detailRes = await axios.get(`${TMDB_BASE_URL}/movie/${basicData.id}`, {
                            params: {
                                api_key: TMDB_API_KEY,
                                language: 'es-ES',
                                append_to_response: 'videos,watch/providers',
                                include_video_language: 'es,en,null'
                            }
                        });
                        /** @type {TMDBDetail} */
                        const d = detailRes.data;
                        // noinspection JSUnresolvedVariable
                        const releaseDate = d.release_date;
                        const platforms = getWatchProviders(d['watch/providers'], releaseDate);

                        // noinspection JSUnresolvedVariable
                        const movie = new Movie({
                            title: d.title,
                            overview: d.overview,
                            // noinspection JSUnresolvedVariable
                            posterUrl: d.poster_path ? `${TMDB_IMG_URL}${d.poster_path}` : null,
                            // noinspection JSUnresolvedVariable
                            backdropUrl: d.backdrop_path ? `${TMDB_BACKDROP_URL}${d.backdrop_path}` : null,
                            tmdbId: d.id,
                            releaseDate: releaseDate,
                            voteAverage: d.vote_average,
                            genres: d.genres.map(g => g.name),
                            trailerKey: findTrailer(d.videos),
                            duration: d.runtime,
                            languages: d.spoken_languages.map(l => l.name),
                            platforms: platforms,
                            watchLink: platforms.length > 0 ? platforms[0].link : null,
                            originCountry: ['PE'] // Aseguramos que guarde la etiqueta
                        });
                        // noinspection JSUnresolvedFunction
                        await movie.save();
                        process.stdout.write('+');
                    } catch (innerErr) {
                        process.stdout.write('x');
                    }
                } else {
                    process.stdout.write('.');
                }
            }
        }
    } catch (err) {
        console.error('Error en Películas:', err.message);
    }
}

async function importPeruvianTVShows() {
    try {
        // Cambiamos el /tv/popular por /discover/tv para poder filtrar por país
        console.log('\n\n📺 Importando Series Peruanas...');
        for (let page = 1; page <= PAGES_TO_FETCH; page++) {
            const response = await axios.get(`${TMDB_BASE_URL}/discover/tv`, {
                params: {
                    api_key: TMDB_API_KEY,
                    language: 'es-ES',
                    include_adult: 'false',
                    with_origin_country: 'PE', // <-- FILTRO DE PAÍS PE
                    sort_by: 'popularity.desc',
                    page: page
                }
            });

            for (const basicData of response.data.results) {
                // Ignorar entradas sin poster
                if (!basicData.poster_path) { process.stdout.write('_'); continue; }
                if (TVSHOW_BLACKLIST.has(basicData.id)) { process.stdout.write('⊘'); continue; }
                // noinspection JSUnresolvedFunction
                const existing = await TVShow.findOne({ tmdbId: basicData.id });
                if (!existing) {
                    try {
                        const detailRes = await axios.get(`${TMDB_BASE_URL}/tv/${basicData.id}`, {
                            params: {
                                api_key: TMDB_API_KEY,
                                language: 'es-ES',
                                append_to_response: 'videos,watch/providers',
                                include_video_language: 'es,en,null'
                            }
                        });
                        /** @type {TMDBDetail} */
                        const d = detailRes.data;
                        // noinspection JSUnresolvedVariable
                        const firstAirDate = d.first_air_date;
                        const platforms = getWatchProviders(d['watch/providers'], firstAirDate);

                        // noinspection JSUnresolvedVariable
                        const show = new TVShow({
                            name: d.name,
                            overview: d.overview,
                            // noinspection JSUnresolvedVariable
                            posterUrl: d.poster_path ? `${TMDB_IMG_URL}${d.poster_path}` : null,
                            // noinspection JSUnresolvedVariable
                            backdropUrl: d.backdrop_path ? `${TMDB_BACKDROP_URL}${d.backdrop_path}` : null,
                            tmdbId: d.id,
                            firstAirDate: firstAirDate,
                            voteAverage: d.vote_average,
                            genres: d.genres.map(g => g.name),
                            trailerKey: findTrailer(d.videos),
                            seasons: d.number_of_seasons,
                            languages: d.spoken_languages.map(l => l.name),
                            platforms: platforms,
                            watchLink: platforms.length > 0 ? platforms[0].link : null,
                            originCountry: ['PE'] // Aseguramos que guarde la etiqueta
                        });
                        // noinspection JSUnresolvedFunction
                        await show.save();
                        process.stdout.write('+');
                    } catch (innerErr) {
                        process.stdout.write('x');
                    }
                } else {
                    process.stdout.write('.');
                }
            }
        }
    } catch (err) {
        console.error('Error Series:', err.message);
    }
}

async function runSeed() {
    console.log('🚀 Iniciando Seeding Masivo Peruano...');
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Conectado a MongoDB Atlas.');

        console.log('🧹 Limpiando colecciones antiguas (Tierra arrasada)...');
        await Movie.deleteMany({});
        await TVShow.deleteMany({});
        console.log('✨ Base de datos en blanco y lista.');

        await importPeruvianMovies();
        await importPeruvianTVShows();

        console.log('\n\n✅ ¡Base de datos poblada exitosamente SOLO con contenido de Perú!');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

// Exportamos las funciones de importación (NO destructivas: omiten lo ya existente)
// para poder reutilizarlas desde el arranque automático del servidor (bootstrap).
module.exports = { importPeruvianMovies, importPeruvianTVShows };

// Solo ejecuta el seeding completo (con borrado previo) cuando se corre
// directamente como script: `node seed.js`. Al hacer require(...) no se dispara.
if (require.main === module) {
    runSeed().catch(err => {
        console.error(err);
        process.exit(1);
    });
}