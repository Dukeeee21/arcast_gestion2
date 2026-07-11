const mongoose = require('mongoose');

/**
 * Registro de auditoría CANÓNICO y ÚNICO del sistema.
 *
 * IMPORTANTE (histórico): antes existían DOS esquemas distintos compitiendo por
 * el nombre 'AuditLog' (uno aquí y otro embebido en audit.service.js). Mongoose
 * se quedaba con el primero que cargara y descartaba los campos del otro; peor
 * aún, este esquema declaraba `module` como requerido mientras el servicio nunca
 * lo enviaba, por lo que cada escritura podía fallar en silencio. Este archivo
 * es ahora la ÚNICA definición: audit.service.js la reutiliza.
 *
 * Trazabilidad de grado estatal:
 *   - Append-only: la app nunca actualiza ni borra registros (no exponemos
 *     métodos de mutación). Para reforzarlo a nivel de motor puede activarse una
 *     colección de solo-inserción desde infraestructura.
 *   - Cadena de integridad: cada registro guarda el hash del anterior (`prevHash`)
 *     y su propio `hash` = SHA-256(prevHash + payload). Alterar un registro
 *     rompe la cadena y se detecta con verifyChain().
 */
const AuditLogSchema = new mongoose.Schema({
  // Quién
  userId: { type: String, default: 'system' },
  username: { type: String },            // Nombre legible para el reporte "[Juan Pérez] editó..."
  role: { type: String },

  // Qué
  action: { type: String, required: true },     // Ej: "MOVIE_UPDATE", "MOVIE_DELETE"
  module: { type: String, default: 'GENERAL' }, // Ej: "CATALOG", "USERS" (se infiere si no se pasa)
  severity: { type: String, enum: ['INFO', 'WARN', 'CRITICAL'], default: 'INFO' },

  // Detalle y contexto
  details: { type: Object },
  ip: { type: String },
  timestamp: { type: Date, default: Date.now },

  // Cadena de integridad (WORM verificable)
  prevHash: { type: String, default: '' },
  hash: { type: String, index: true },
});

// Consultas típicas del panel de auditoría: por fecha y por módulo/acción.
AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ module: 1, action: 1 });

module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
