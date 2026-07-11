/**
 * Seed CURADO de películas peruanas realmente reproducibles (verificadas a mano
 * en archive.org, con archivo de video directo). A diferencia de seed.js, esto
 * NO borra nada: hace upsert por título y deja el `watchLink` listo para el
 * reproductor híbrido (archive.org).
 *
 * Uso:  docker-compose exec api-core node seed-archive.js
 *
 * Si hay TMDB_API_KEY, enriquece póster/backdrop/sinopsis/valoración desde TMDB.
 */
const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

/** @type {any} */
const Movie = require('./src/modules/catalog/movie.model');

// Fuente de video = URL directa .mp4 en archive.org (verificada reproducible).
const FILMS = [
    { title: 'Paloma de papel', year: 2003, genres: ['Drama'],
      overview: 'Un niño de los Andes es reclutado a la fuerza por Sendero Luminoso; años después regresa a su pueblo.',
      watchLink: 'https://archive.org/download/paloma-de-papel_2003/PALOMA%20DE%20PAPEL.mp4' },
    { title: 'Madeinusa', year: 2006, genres: ['Drama'],
      overview: 'En un pueblo andino, durante la Semana Santa, una joven vive un ritual donde "Dios está muerto".',
      watchLink: 'https://archive.org/download/madeinusa-2006/Madeinusa%20(2006).mp4' },
    { title: 'El destino no tiene favoritos', year: 2003, genres: ['Comedia'],
      overview: 'Una comedia sobre una telenovela que se filma en la casa de un ama de casa limeña.',
      watchLink: 'https://archive.org/download/el-destino-no-tiene-favoritos/EL_DESTINO_NO_TIENE_FAVORITOS.mp4' },
    { title: 'Wiñaypacha', year: 2018, genres: ['Drama'],
      overview: 'Primera película en aymara: una pareja de ancianos sobrevive en los Andes esperando a su hijo.',
      watchLink: 'https://archive.org/download/peliculapunenawinaypacha2018dvdcompleto/((Pel%C3%ADcula%20Pune%C3%B1a))%20Wi%C3%B1aypacha%202018%20-%20DVD%20Completo.mp4' },
    { title: 'La ciudad y los perros', year: 1985, genres: ['Drama'],
      overview: 'Adaptación de la novela de Vargas Llosa sobre la vida en un colegio militar de Lima.',
      watchLink: 'https://archive.org/download/la-ciudad-y-los-perros-1985-480p/La%20Ciudad%20y%20Los%20Perros(1985)480p.ia.mp4' },
    { title: 'Maruja en el infierno', year: 1983, genres: ['Drama'],
      overview: 'Basada en la novela de Enrique Congrains, retrata los márgenes de la Lima de los años 80.',
      watchLink: 'https://archive.org/download/maruja-en-el-infierno-1983/Maruja%20en%20el%20Infierno%20-%201983.mp4' },
    { title: 'Bromas S.A.', year: 1967, genres: ['Comedia'],
      overview: 'Clásica comedia peruana de episodios protagonizada por reconocidos cómicos de la época.',
      watchLink: 'https://archive.org/download/y-2-mate.is-bromas-s.-a.-1967-bopav-ajslfw-720p-1641879199146-1/Y2Mate.is%20-%20Bromas%20S.A.%20%20(1967%20)-bopavAJSlfw-720p-1641879199146%20(1).mp4' },
];

const TMDB_KEY = process.env.TMDB_API_KEY;
const IMG = 'https://image.tmdb.org/t/p/w500';
const BACKDROP = 'https://image.tmdb.org/t/p/original';

async function enrichFromTMDB(film) {
    if (!TMDB_KEY) return {};
    try {
        const { data } = await axios.get('https://api.themoviedb.org/3/search/movie', {
            params: { api_key: TMDB_KEY, query: film.title, year: film.year, language: 'es-ES' },
            timeout: 8000,
        });
        const hit = (data.results || [])[0];
        if (!hit) return {};
        return {
            tmdbId: String(hit.id),
            posterUrl: hit.poster_path ? IMG + hit.poster_path : null,
            backdropUrl: hit.backdrop_path ? BACKDROP + hit.backdrop_path : null,
            voteAverage: hit.vote_average,
            overview: hit.overview || film.overview,
        };
    } catch {
        return {};
    }
}

// Siembra las películas curadas. Asume que ya hay conexión a Mongo abierta.
// Idempotente: no duplica y solo enriquece desde TMDB cuando hace falta.
async function seedCuratedArchive() {
    let added = 0, updated = 0;
    for (const film of FILMS) {
        const existing = await Movie.findOne({ title: film.title });

        if (existing) {
            existing.watchLink = film.watchLink;
            existing.originCountry = ['PE'];
            // Solo llamamos a TMDB si aún le falta el póster (evita pedidos innecesarios).
            if (!existing.posterUrl) {
                const extra = await enrichFromTMDB(film);
                if (extra.posterUrl) existing.posterUrl = extra.posterUrl;
                if (extra.backdropUrl) existing.backdropUrl = extra.backdropUrl;
                if (extra.voteAverage && !existing.voteAverage) existing.voteAverage = extra.voteAverage;
            }
            await existing.save();
            updated++;
        } else {
            const extra = await enrichFromTMDB(film);
            await Movie.create({
                title: film.title,
                releaseDate: String(film.year),
                genres: film.genres,
                overview: extra.overview || film.overview,
                watchLink: film.watchLink,
                originCountry: ['PE'],
                posterUrl: extra.posterUrl || null,
                backdropUrl: extra.backdropUrl || null,
                voteAverage: extra.voteAverage,
                tmdbId: extra.tmdbId,
            });
            added++;
        }
    }
    return { added, updated };
}

module.exports = { seedCuratedArchive };

if (require.main === module) {
    (async () => {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Conectado. Sembrando catálogo curado reproducible...');
        const { added, updated } = await seedCuratedArchive();
        console.log(`\nListo. Nuevas: ${added}, actualizadas: ${updated}. Todas con video en archive.org.`);
        await mongoose.disconnect();
        process.exit(0);
    })().catch((err) => {
        console.error('Error en seed-archive:', err.message);
        process.exit(1);
    });
}
