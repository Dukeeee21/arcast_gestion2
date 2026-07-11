/**
 * Sube los videos locales (media/) a Cloudflare R2 para que el despliegue
 * público (Render + Vercel) no dependa del disco de este servidor.
 *
 * Solo necesita correr UNA VEZ (o cuando se agregue una película local nueva).
 * Usa multipart upload (@aws-sdk/lib-storage) porque los archivos pesan
 * cientos de MB. Es idempotente: si el r2Key ya está seteado, salta ese
 * archivo salvo que se pase --force.
 *
 * Uso (desde la máquina, NO dentro de Docker):
 *   cd api-core
 *   node upload-to-r2.js
 */
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { Upload } = require('@aws-sdk/lib-storage');
require('dotenv').config();

const { getClient, isR2Configured } = require('./src/common/r2.util');
/** @type {any} */
const Movie = require('./src/modules/catalog/movie.model');

const MEDIA_DIR = path.resolve(__dirname, '../media');
const MONGO_URI_LOCAL = 'mongodb://localhost:27017/ReelScoreDB';
const FORCE = process.argv.includes('--force');

async function uploadFile(localPath, key) {
    const fileStream = fs.createReadStream(localPath);
    const { size } = fs.statSync(localPath);

    const upload = new Upload({
        client: getClient(),
        params: {
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            Body: fileStream,
            ContentType: 'video/mp4',
        },
        queueSize: 4,
        partSize: 20 * 1024 * 1024, // 20 MB por parte
    });

    let lastPct = -10;
    upload.on('httpUploadProgress', (p) => {
        const pct = Math.round((p.loaded / size) * 100);
        if (pct >= lastPct + 10) {
            process.stdout.write(` ${pct}%`);
            lastPct = pct;
        }
    });

    await upload.done();
}

async function run() {
    if (!isR2Configured()) {
        console.error('Faltan variables R2_* en .env (R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME).');
        process.exit(1);
    }

    await mongoose.connect(MONGO_URI_LOCAL);
    console.log('Conectado a MongoDB.\n');

    const movies = await Movie.find({ localPath: { $exists: true, $nin: [null, ''] } });
    console.log(`Películas con video local: ${movies.length}\n`);

    let uploaded = 0, skipped = 0, failed = 0;

    for (const movie of movies) {
        if (movie.r2Key && !FORCE) {
            console.log(`⏭  Ya subida: ${movie.title}`);
            skipped++;
            continue;
        }

        const relPath = movie.localPath.replace(/^\/media\//, '');
        const absPath = path.join(MEDIA_DIR, relPath);

        if (!fs.existsSync(absPath)) {
            console.log(`✗  Archivo no encontrado: ${movie.title} (${absPath})`);
            failed++;
            continue;
        }

        const key = `movies/${movie._id}.mp4`;
        const sizeMB = (fs.statSync(absPath).size / 1024 / 1024).toFixed(0);
        process.stdout.write(`⬆  ${movie.title} (${sizeMB} MB):`);

        try {
            await uploadFile(absPath, key);
            await Movie.updateOne({ _id: movie._id }, { $set: { r2Key: key } });
            console.log(' ✅');
            uploaded++;
        } catch (err) {
            console.log(`\n✗  Error subiendo ${movie.title}: ${err.message}`);
            failed++;
        }
    }

    console.log(`\n✅ Listo. Subidas: ${uploaded} · Ya estaban: ${skipped} · Fallidas: ${failed}`);
    await mongoose.disconnect();
    process.exit(0);
}

run().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
