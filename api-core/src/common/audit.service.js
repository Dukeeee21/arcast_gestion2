const crypto = require('crypto');
/** @type {any} */
const AuditLog = require('./audit.model'); // Modelo ÚNICO (antes había un esquema duplicado aquí).

/**
 * Infiere el módulo a partir del prefijo de la acción.
 * Ej: "CATALOG_IMPORT" -> "CATALOG", "REVIEW_CREATED" -> "REVIEW".
 */
function inferModule(action = '') {
  const prefix = String(action).split('_')[0];
  return prefix ? prefix.toUpperCase() : 'GENERAL';
}

/** Calcula el hash de un registro encadenado con el anterior. */
function computeHash({ prevHash, userId, action, details, timestamp }) {
  const payload = JSON.stringify({ prevHash, userId, action, details, timestamp });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Registra una acción en la bitácora inmutable (append-only + hash-chain).
 *
 * Firma retrocompatible: el resto del código llama recordMutation(userId,
 * action, details, ip). Se admite además pasar un objeto como 4º argumento
 * para enriquecer el registro (username, role, module, severity).
 *
 * @param {string} userId
 * @param {string} action
 * @param {Object} [details]
 * @param {string|Object} [ipOrOpts] - IP (string) u opciones { ip, username, role, module, severity }
 */
exports.recordMutation = async (userId, action, details = {}, ipOrOpts = 'internal') => {
  try {
    const opts = typeof ipOrOpts === 'object' && ipOrOpts !== null ? ipOrOpts : { ip: ipOrOpts };
    const timestamp = new Date();

    // Enganchamos con el último eslabón de la cadena para garantizar integridad.
    const last = await AuditLog.findOne().sort({ timestamp: -1 }).select('hash').lean();
    const prevHash = last?.hash || '';
    const hash = computeHash({ prevHash, userId, action, details, timestamp });

    await AuditLog.create({
      userId: userId || 'system',
      username: opts.username,
      role: opts.role,
      action,
      module: opts.module || inferModule(action),
      severity: opts.severity || 'INFO',
      details,
      ip: opts.ip || 'internal',
      timestamp,
      prevHash,
      hash,
    });
    console.log(`[AUDIT] ${action} registrado por ${opts.username || userId}`);
  } catch (err) {
    // La auditoría nunca debe tumbar la operación de negocio, pero sí gritar.
    console.error('Fallo crítico en el sistema de auditoría:', err.message);
  }
};

/**
 * Verifica la integridad de la cadena completa. Devuelve el primer registro
 * cuyo hash no cuadra (evidencia de manipulación), o null si la cadena es íntegra.
 * Pensado para un endpoint de verificación en la Vista Admin/Jefe.
 */
exports.verifyChain = async () => {
  const logs = await AuditLog.find().sort({ timestamp: 1 }).lean();
  let prevHash = '';
  for (const log of logs) {
    const expected = computeHash({
      prevHash,
      userId: log.userId,
      action: log.action,
      details: log.details,
      timestamp: log.timestamp,
    });
    if (log.prevHash !== prevHash || log.hash !== expected) {
      return { valid: false, brokenAt: log._id, timestamp: log.timestamp };
    }
    prevHash = log.hash;
  }
  return { valid: true, count: logs.length };
};
