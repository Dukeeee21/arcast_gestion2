/**
 * Migración institucional (Fase 0) — idempotente.
 *
 * Rellena los campos nuevos del estándar gubernamental en los documentos que ya
 * existían antes del refactor, para que el catálogo actual NO desaparezca ni
 * quede inconsistente al activar filtros, flujo de aprobación y DRM.
 *
 * Es segura de correr N veces: solo toca documentos a los que les falta el campo
 * (filtro `$exists: false`), así que una segunda ejecución no hace nada.
 *
 * Uso manual (con Docker corriendo):
 *   docker-compose exec api-core node migrate-institutional.js
 *
 * También se ejecuta sola en el arranque (ver bootstrap.js).
 */
const mongoose = require('mongoose');

/** @type {any} */
const Movie = require('./src/modules/catalog/movie.model');
/** @type {any} */
const User = require('./src/modules/users/user.model');

async function migrateInstitutional({ log = console.log } = {}) {
  // --- Películas: backfill de la ficha institucional en contenido heredado ---
  const movies = await Movie.updateMany(
    { estadoPublicacion: { $exists: false } },
    {
      $set: {
        estadoPublicacion: 'Aprobado', // el contenido previo ya era público
        visible: true,
        fondoEstatal: 'No Aplica',
        presupuestoAprobado: 0,
        attachments: [],
      },
    },
  );

  // Garantiza que `visible` exista incluso en docs que sí tuvieran estadoPublicacion.
  const visibility = await Movie.updateMany(
    { visible: { $exists: false } },
    { $set: { visible: true } },
  );

  // Deriva el año numérico (`anio`) desde `releaseDate` ("YYYY-MM-DD") para que el
  // filtro por rango de años funcione sobre el contenido ya existente. Es una
  // derivación honesta del dato real, no un valor inventado.
  const years = await Movie.updateMany(
    { anio: { $exists: false }, releaseDate: { $type: 'string', $ne: '' } },
    [{
      $set: {
        anio: {
          $convert: {
            input: { $substrCP: ['$releaseDate', 0, 4] },
            to: 'int', onError: null, onNull: null,
          },
        },
      },
    }],
  );

  // --- Usuarios: materializa el flag de consentimiento PII en cuentas previas ---
  const users = await User.updateMany(
    { consentPII: { $exists: false } },
    { $set: { consentPII: false } },
  );

  log(`[migrate] Películas actualizadas: ${movies.modifiedCount} (ficha) + ${visibility.modifiedCount} (visible) + ${years.modifiedCount} (año).`);
  log(`[migrate] Usuarios actualizados: ${users.modifiedCount} (consentPII).`);

  return {
    moviesMigrated: movies.modifiedCount,
    usersMigrated: users.modifiedCount,
  };
}

module.exports = { migrateInstitutional };

// Ejecución directa como script CLI.
if (require.main === module) {
  (async () => {
    if (!process.env.MONGO_URI) {
      console.error('Falta MONGO_URI en el entorno.');
      process.exit(1);
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Conectado a MongoDB. Ejecutando migración institucional...');
    await migrateInstitutional({});
    console.log('Migración finalizada.');
    await mongoose.disconnect();
    process.exit(0);
  })().catch((err) => {
    console.error('Error en la migración:', err.message);
    process.exit(1);
  });
}
