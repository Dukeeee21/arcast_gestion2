/**
 * Genera los embeddings (vectores) de todo el catálogo para la búsqueda
 * semántica. Idempotente: solo procesa títulos nuevos o cuyo texto cambió.
 *
 * Uso:
 *   docker-compose exec api-core node embed-catalog.js          # solo lo pendiente
 *   docker-compose exec api-core node embed-catalog.js --force  # regenerar todo
 */
const mongoose = require('mongoose');
require('dotenv').config();

const { ensureCatalogEmbeddings } = require('./src/modules/search/embeddings.service');

if (require.main === module) {
    (async () => {
        if (!process.env.GEMINI_API_KEY) {
            console.error('Falta GEMINI_API_KEY; no se pueden generar embeddings.');
            process.exit(1);
        }
        const force = process.argv.slice(2).includes('--force');

        await mongoose.connect(process.env.MONGO_URI);
        console.log(`Conectado. Generando embeddings del catálogo${force ? ' (--force)' : ''}...`);
        const { processed, skipped, failed } = await ensureCatalogEmbeddings({ force });
        console.log(`\nHecho. Generados/actualizados: ${processed}, sin cambios: ${skipped}, fallidos: ${failed}.`);
        await mongoose.disconnect();
        process.exit(0);
    })().catch((err) => {
        console.error('Error en embed-catalog:', err.message);
        process.exit(1);
    });
}
