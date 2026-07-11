/**
 * Rellena el póster/backdrop de películas sin imagen (las del seed institucional
 * traen un tmdbId falso tipo "seed-la-teta-asustada", así que no se pueden
 * buscar por ID). Busca cada una por TÍTULO en TMDB, descarga la imagen real
 * UNA VEZ a ui-web/public/ (mismo patrón que fetch-posters.js, sin depender de
 * TMDB en tiempo real) y actualiza Mongo.
 *
 * Uso (desde la máquina, NO dentro de Docker — necesita escribir en ui-web/):
 *   cd api-core
 *   node fix-institutional-posters.js
 */
const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/** @type {any} */
const Movie = require('./src/modules/catalog/movie.model');

const TMDB_KEY = process.env.TMDB_API_KEY;
const IMG = 'https://image.tmdb.org/t/p/w500';
const BACKDROP = 'https://image.tmdb.org/t/p/original';
const POSTERS_DIR = path.resolve(__dirname, '../ui-web/public/posters');
const BACKDROPS_DIR = path.resolve(__dirname, '../ui-web/public/backdrops');
const MONGO_URI_LOCAL = 'mongodb://localhost:27017/ReelScoreDB';

async function downloadImage(url, destPath) {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
    fs.writeFileSync(destPath, res.data);
}

async function run() {
    fs.mkdirSync(POSTERS_DIR, { recursive: true });
    fs.mkdirSync(BACKDROPS_DIR, { recursive: true });

    await mongoose.connect(MONGO_URI_LOCAL);
    console.log('Conectado a MongoDB.');

    const movies = await Movie.find({ $or: [{ posterUrl: null }, { posterUrl: '' }, { posterUrl: { $exists: false } }] });
    console.log(`Películas sin póster: ${movies.length}\n`);

    let fixed = 0, notFound = 0;

    for (const movie of movies) {
        try {
            const { data } = await axios.get('https://api.themoviedb.org/3/search/movie', {
                params: { api_key: TMDB_KEY, query: movie.title, language: 'es-ES' },
            });
            const hit = data.results?.[0];
            if (!hit || !hit.poster_path) {
                console.log(`  x sin resultado en TMDB: ${movie.title}`);
                notFound++;
                continue;
            }

            const id = String(movie._id);
            const updates = {};

            const posterPath = path.join(POSTERS_DIR, `${id}.jpg`);
            await downloadImage(`${IMG}${hit.poster_path}`, posterPath);
            updates.posterUrl = `/posters/${id}.jpg`;

            if (hit.backdrop_path) {
                const backdropPath = path.join(BACKDROPS_DIR, `${id}.jpg`);
                await downloadImage(`${BACKDROP}${hit.backdrop_path}`, backdropPath);
                updates.backdropUrl = `/backdrops/${id}.jpg`;
            }

            await Movie.updateOne({ _id: movie._id }, { $set: updates });
            console.log(`  + ${movie.title} <- TMDB #${hit.id}`);
            fixed++;
        } catch (err) {
            console.log(`  x error con ${movie.title}: ${err.message}`);
            notFound++;
        }
    }

    console.log(`\n✅ Listo. Corregidas: ${fixed} · Sin resultado: ${notFound}`);
    console.log(`   Falta: reconstruir el contenedor ui-web para que nginx sirva las imágenes nuevas.`);

    await mongoose.disconnect();
    process.exit(0);
}

run().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
