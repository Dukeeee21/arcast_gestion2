/**
 * Arranque automático (bootstrap) que corre al iniciar el servidor.
 *
 * Objetivo: que un `docker-compose up --build` deje TODO listo sin comandos
 * manuales:
 *   - ensureBaseUsers(): crea las cuentas base si no existen (idempotente).
 *   - maybeSeedCatalog(): importa el catálogo peruano de TMDB si está vacío.
 *   - ensureCuratedArchive(): añade las películas curadas reproducibles.
 *   - maybeMatchArchive(): busca fuentes en archive.org para el resto (UNA vez).
 *   - maybeEmbedCatalog(): genera los embeddings para la búsqueda semántica.
 *
 * Las tareas de catálogo corren en segundo plano para no retrasar el arranque.
 */
const mongoose = require('mongoose');
/** @type {any} */
const User = require('../modules/users/user.model');
/** @type {any} */
const Movie = require('../modules/catalog/movie.model');

// Marcador persistente para tareas que solo deben correr una vez (ej: el matcher).
const BootstrapState = mongoose.models.BootstrapState ||
    mongoose.model('BootstrapState', new mongoose.Schema({
        key: { type: String, unique: true },
        done: Boolean,
        at: Date,
    }));

const BASE_USERS = [
    { username: 'SuperAdmin', email: 'admin@arcast.com',        password: 'admin123',   role: 'admin' },
    { username: 'jefe',       email: 'jefe@gmail.com',          password: 'contraseña', role: 'admin'  },
    { username: 'adrian',     email: 'adrian23erick@gmail.com', password: 'contraseña', role: 'user'  },
];

const flag = (name, def = 'true') => String(process.env[name] ?? def).toLowerCase() !== 'false';
const flagOn = (name) => String(process.env[name] ?? '').toLowerCase() === 'true';

async function ensureBaseUsers() {
    if (!flag('AUTO_SEED_USERS')) return;
    let created = 0;
    for (const u of BASE_USERS) {
        const existing = await User.findOne({ email: u.email });
        if (!existing) { await User.create(u); created++; }
    }
    console.log(created > 0 ? `[bootstrap] Cuentas base creadas: ${created}` : '[bootstrap] Cuentas base ya presentes.');
}

async function maybeSeedCatalog() {
    if (!flagOn('AUTO_SEED_CATALOG')) return;
    if (!process.env.TMDB_API_KEY) {
        console.log('[bootstrap] AUTO_SEED_CATALOG activo pero falta TMDB_API_KEY; se omite.');
        return;
    }
    if ((await Movie.countDocuments()) > 0) return;

    console.log('[bootstrap] Catálogo vacío: importando contenido peruano desde TMDB...');
    try {
        const { importPeruvianMovies, importPeruvianTVShows } = require('../../seed');
        await importPeruvianMovies();
        await importPeruvianTVShows();
        console.log('[bootstrap] Importación TMDB finalizada.');
    } catch (err) {
        console.error('[bootstrap] Error importando TMDB (no crítico):', err.message);
    }
}

async function ensureCuratedArchive() {
    if (!flag('AUTO_SEED_ARCHIVE')) return;
    try {
        const { seedCuratedArchive } = require('../../seed-archive');
        const { added, updated } = await seedCuratedArchive();
        console.log(`[bootstrap] Catálogo curado reproducible: +${added} nuevas, ${updated} actualizadas.`);
    } catch (err) {
        console.error('[bootstrap] Error en seed curado (no crítico):', err.message);
    }
}

async function maybeMatchArchive() {
    if (!flagOn('AUTO_MATCH_ARCHIVE')) return;
    const state = await BootstrapState.findOne({ key: 'archiveMatch' });
    if (state && state.done) return; // ya corrió una vez; para repetir: node match-archive.js

    console.log('[bootstrap] Buscando fuentes en archive.org (una sola vez, puede tardar)...');
    try {
        const { matchArchive } = require('../../match-archive');
        const { pending, matched } = await matchArchive({ log: () => {} });
        console.log(`[bootstrap] Matcher archive.org: ${matched}/${pending} con fuente reproducible.`);
        await BootstrapState.updateOne(
            { key: 'archiveMatch' },
            { key: 'archiveMatch', done: true, at: new Date() },
            { upsert: true },
        );
    } catch (err) {
        console.error('[bootstrap] Error en matcher (no crítico):', err.message);
    }
}

async function maybeEmbedCatalog() {
    // Se activa por defecto si hay clave de Gemini; es incremental (solo procesa
    // títulos nuevos o cambiados), así que correr en cada arranque es barato.
    if (!flag('AUTO_EMBED_CATALOG')) return;
    if (!process.env.GEMINI_API_KEY) return;

    try {
        const { ensureCatalogEmbeddings } = require('../modules/search/embeddings.service');
        const { processed, skipped, failed } = await ensureCatalogEmbeddings({ log: () => {} });
        console.log(`[bootstrap] Embeddings búsqueda semántica: +${processed} generados, ${skipped} al día, ${failed} fallidos.`);
    } catch (err) {
        console.error('[bootstrap] Error generando embeddings (no crítico):', err.message);
    }
}

/**
 * Se llama tras conectar a Mongo. Las cuentas se esperan (rápido); las tareas de
 * catálogo se ejecutan en segundo plano para no retrasar el arranque del server.
 */
async function runBootstrap() {
    try {
        await ensureBaseUsers();
    } catch (err) {
        console.error('[bootstrap] Error creando cuentas base:', err.message);
    }

    // Migración institucional (Fase 0): backfill idempotente de los campos nuevos
    // en el contenido heredado. Se espera (es rápido) para que el catálogo quede
    // consistente antes de servir peticiones.
    try {
        const { migrateInstitutional } = require('../../migrate-institutional');
        await migrateInstitutional({ log: (m) => console.log(m) });
    } catch (err) {
        console.error('[bootstrap] Error en migración institucional (no crítico):', err.message);
    }

    // Cron de vencimiento de derechos (DRM): corre una pasada y se autoagenda.
    try {
        const { startDrmCron } = require('./drm.cron');
        startDrmCron();
    } catch (err) {
        console.error('[bootstrap] Error iniciando cron DRM (no crítico):', err.message);
    }

    (async () => {
        await maybeSeedInstitutional();
        await maybeSeedCatalog();
        await ensureCuratedArchive();
        await maybeMatchArchive();
        await maybeEmbedCatalog();
    })().catch((err) => console.error('[bootstrap] Error en tareas de catálogo:', err.message));
}

// Seed institucional (películas de media/ + usuarios con región + reproducciones
// georreferenciadas). Sólo corre si AUTO_SEED_INSTITUTIONAL=true.
async function maybeSeedInstitutional() {
    if (!flagOn('AUTO_SEED_INSTITUTIONAL')) return;
    try {
        const { seedInstitucional } = require('../../seed-institucional');
        await seedInstitucional({ log: (m) => console.log(m) });
    } catch (err) {
        console.error('[bootstrap] Error en seed institucional (no crítico):', err.message);
    }
}

module.exports = { runBootstrap, ensureBaseUsers, maybeSeedCatalog, ensureCuratedArchive, maybeMatchArchive, maybeEmbedCatalog };
