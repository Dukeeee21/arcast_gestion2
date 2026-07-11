const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Citas académicas exportadas por el investigador (aparecen en "Citas Exportadas"
 * del perfil). Se persiste la referencia ya formateada para tener trazabilidad de
 * qué material se citó, en qué formato y para qué proyecto.
 */
const CitationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  contentId: { type: String, required: true },
  contentTitle: { type: String },
  format: { type: String, enum: ['APA', 'Chicago'], default: 'APA' },
  reference: { type: String, required: true }, // Texto ya formateado, listo para copiar.
  project: { type: String, default: null },     // Proyecto de investigación asociado (opcional).
}, { timestamps: true });

module.exports = mongoose.model('Citation', CitationSchema);
