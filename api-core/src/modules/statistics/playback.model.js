const mongoose = require('mongoose');

const playbackLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    contentId: { type: String, required: true },
    contentType: { type: String, enum: ['Movie', 'TVShow'] },
    durationMinutes: { type: Number, required: true }, // Minutos de consumo en esta sesión
    // Región (departamento) desde la que se reprodujo: se copia del usuario al
    // hacer Play para alimentar el mapa de impacto territorial de la Vista Jefe.
    // Se desnormaliza a propósito: así el mapa no depende de que el usuario siga
    // existiendo ni cambie su región después.
    region: { type: String, default: null },
    timestamp: { type: Date, default: Date.now }
});

// Índices para las agregaciones por fecha y por territorio (mapa del Jefe).
playbackLogSchema.index({ timestamp: 1 });
playbackLogSchema.index({ region: 1, timestamp: 1 });

module.exports = mongoose.model('PlaybackLog', playbackLogSchema);
