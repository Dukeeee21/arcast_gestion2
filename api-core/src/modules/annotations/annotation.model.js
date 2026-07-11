const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Notas_Usuario — anotaciones de investigación ancladas a un minuto exacto del
 * material audiovisual. Es la herramienta de estudio de la Vista Investigador:
 * al pausar el reproductor se captura el cronómetro (segundos) y se guarda junto
 * al texto del usuario para poder volver a ese punto y para citar en informes.
 */
const AnnotationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  contentId: { type: String, required: true, index: true }, // _id de Movie/TVShow (o episodio)
  contentType: { type: String, enum: ['Movie', 'TVShow'], default: 'Movie' },

  // Marca de tiempo EXACTA dentro del video, en segundos (ej. 75 = 01:15).
  timestampSeconds: { type: Number, required: true, min: 0 },

  text: { type: String, required: true, trim: true, maxlength: 4000 },
}, { timestamps: true });

// Consulta típica: "mis notas de esta película, ordenadas por minuto".
AnnotationSchema.index({ userId: 1, contentId: 1, timestampSeconds: 1 });

module.exports = mongoose.model('Annotation', AnnotationSchema);
