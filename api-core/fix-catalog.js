/**
 * fix-catalog.js
 * 1. Elimina del DB películas y series sin posterUrl
 * 2. Importa más páginas de TMDB (solo con poster) para compensar
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { importPeruvianMovies, importPeruvianTVShows } = require('./seed');
const Movie  = require('./src/modules/catalog/movie.model');
const TVShow = require('./src/modules/catalog/tvshow.model');

async function main() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ReelScoreDB');
    console.log('Conectado a MongoDB\n');

    // 1. Eliminar los sin poster
    const delMovies = await Movie.deleteMany({
        $or: [{ posterUrl: { $exists: false } }, { posterUrl: null }, { posterUrl: '' }]
    });
    const delShows = await TVShow.deleteMany({
        $or: [{ posterUrl: { $exists: false } }, { posterUrl: null }, { posterUrl: '' }]
    });
    console.log(`Eliminados: ${delMovies.deletedCount} películas, ${delShows.deletedCount} series sin poster\n`);

    // 2. Importar más contenido (el seed ya filtra poster_path vacío)
    console.log('Importando nuevo contenido desde TMDB...');
    await importPeruvianMovies();
    await importPeruvianTVShows();

    console.log('\n\nListo.');
    await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
