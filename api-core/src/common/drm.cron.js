/**
 * Cron de vigencia de derechos (DRM).
 *
 * Evita el riesgo legal de exhibir material con contrato vencido. Cada madrugada
 * revisa la base y OCULTA automáticamente toda película cuya
 * `fechaVencimientoDerechos` ya pasó: el administrador no tiene que hacerlo a mano.
 *
 * No usa dependencias externas (no hay node-cron en el proyecto): se agenda con
 * setTimeout hacia la próxima madrugada (03:00 hora Perú) y luego cada 24h.
 */
/** @type {any} */
const Movie = require('../modules/catalog/movie.model');
const audit = require('./audit.service');

const DAY_MS = 24 * 60 * 60 * 1000;
const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000; // UTC-5 (Perú no aplica horario de verano)

/**
 * Oculta el contenido con derechos vencidos. Idempotente: solo toca lo que aún
 * está visible y ya expiró. Devuelve cuántas obras se ocultaron.
 */
async function enforceRightsExpiry({ log = console.log } = {}) {
  const now = new Date();
  const expired = await Movie.find({
    deletedAt: null,
    fechaVencimientoDerechos: { $ne: null, $lte: now },
    visible: { $ne: false },
  }).select('_id title fechaVencimientoDerechos').lean();

  if (expired.length === 0) {
    log('[drm] Sin contenido con derechos vencidos.');
    return 0;
  }

  const ids = expired.map((m) => m._id);
  await Movie.updateMany(
    { _id: { $in: ids } },
    { $set: { visible: false, estadoPublicacion: 'Oculto' } },
  );

  await audit.recordMutation(
    'system', 'CONTENT_RIGHTS_EXPIRED',
    { count: expired.length, titulos: expired.map((m) => m.title) },
    { module: 'DRM', severity: 'CRITICAL' },
  );

  log(`[drm] ${expired.length} obra(s) ocultada(s) por vencimiento de derechos.`);
  return expired.length;
}

/** Milisegundos hasta la próxima madrugada (03:00 hora Perú). */
function msUntilNextRun() {
  const nowLima = new Date(Date.now() - LIMA_OFFSET_MS);
  const next = new Date(nowLima);
  next.setUTCHours(3, 0, 0, 0);
  if (next <= nowLima) next.setTime(next.getTime() + DAY_MS);
  return next.getTime() - nowLima.getTime();
}

/**
 * Arranca el cron: corre una pasada al inicio (por si el server estuvo caído a la
 * hora agendada) y luego se autoagenda cada madrugada.
 */
function startDrmCron() {
  enforceRightsExpiry().catch((e) => console.error('[drm] Error en pasada inicial:', e.message));

  const schedule = () => {
    setTimeout(async () => {
      await enforceRightsExpiry().catch((e) => console.error('[drm] Error en pasada diaria:', e.message));
      setInterval(() => {
        enforceRightsExpiry().catch((e) => console.error('[drm] Error en pasada diaria:', e.message));
      }, DAY_MS);
    }, msUntilNextRun());
  };
  schedule();
  console.log('[drm] Cron de vencimiento de derechos activado (próxima madrugada 03:00 hora Perú).');
}

module.exports = { enforceRightsExpiry, startDrmCron };
