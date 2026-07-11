/**
 * Caché LOCAL de pósters/backdrops — descarga las imágenes de TMDB UNA SOLA VEZ
 * y las deja como archivos propios en ui-web/public/, además de un manifiesto
 * en data/posters-cache.json. Después de correr esto, la app nunca vuelve a
 * depender de una conexión en vivo a TMDB para mostrar carátulas: las sirve
 * el propio servidor (nginx), funcionando incluso sin internet.
 *
 * Uso (desde la máquina, NO dentro de Docker — necesita escribir en ui-web/):
 *   cd api-core
 *   node fetch-posters.js
 *
 * Requiere que el contenedor de Mongo esté corriendo (puerto 27017 publicado).
 * Es idempotente: si el archivo local ya existe, no lo vuelve a descargar.
 */
const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/** @type {any} */
const Movie = require('./src/modules/catalog/movie.model');

const POSTERS_DIR = path.resolve(__dirname, '../ui-web/public/posters');
const BACKDROPS_DIR = path.resolve(__dirname, '../ui-web/public/backdrops');
const CACHE_FILE = path.resolve(__dirname, 'data/posters-cache.json');
const MONGO_URI_LOCAL = 'mongodb://localhost:27017/ReelScoreDB';

async function downloadImage(url, destPath) {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
    fs.writeFileSync(destPath, res.data);
}

async function run() {
    fs.mkdirSync(POSTERS_DIR, { recursive: true });
    fs.mkdirSync(BACKDROPS_DIR, { recursive: true });
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });

    await mongoose.connect(MONGO_URI_LOCAL);
    console.log('Conectado a MongoDB:', MONGO_URI_LOCAL);

    const movies = await Movie.find({
        $or: [
            { posterUrl: /image\.tmdb\.org/ },
            { backdropUrl: /image\.tmdb\.org/ },
        ],
    });
    console.log(`Procesando ${movies.length} películas con imagen en TMDB...\n`);

    let cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8')) : {};
    let downloaded = 0, cached = 0, failed = 0;

    for (const movie of movies) {
        const id = String(movie._id);
        const updates = {};

        if (movie.posterUrl && movie.posterUrl.includes('image.tmdb.org')) {
            const destFile = `${id}.jpg`;
            const destPath = path.join(POSTERS_DIR, destFile);
            try {
                if (fs.existsSync(destPath)) {
                    cached++;
                } else {
                    await downloadImage(movie.posterUrl, destPath);
                    downloaded++;
                }
                updates.posterUrl = `/posters/${destFile}`;
            } catch (err) {
                console.log(`  x póster falló: ${movie.title} (${err.message})`);
                failed++;
            }
        }

        if (movie.backdropUrl && movie.backdropUrl.includes('image.tmdb.org')) {
            const destFile = `${id}.jpg`;
            const destPath = path.join(BACKDROPS_DIR, destFile);
            try {
                if (!fs.existsSync(destPath)) {
                    await downloadImage(movie.backdropUrl, destPath);
                }
                updates.backdropUrl = `/backdrops/${destFile}`;
            } catch (err) {
                console.log(`  x backdrop falló: ${movie.title} (${err.message})`);
            }
        }

        if (Object.keys(updates).length > 0) {
            await Movie.updateOne({ _id: movie._id }, { $set: updates });
            cache[id] = { title: movie.title, ...updates };
            process.stdout.write('.');
        }
    }

    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));

    console.log(`\n\n✅ Listo.`);
    console.log(`   Nuevas descargas: ${downloaded}`);
    console.log(`   Ya en caché:      ${cached}`);
    console.log(`   Fallidas:         ${failed}`);
    console.log(`   Manifiesto JSON:  ${CACHE_FILE}`);
    console.log(`\n   Las URLs en MongoDB ahora apuntan a /posters/ y /backdrops/ (locales).`);
    console.log(`   Falta: reconstruir el contenedor ui-web para que nginx sirva los archivos nuevos.`);

    await mongoose.disconnect();
    process.exit(0);
}

run().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
