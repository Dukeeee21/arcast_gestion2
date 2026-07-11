const mongoose = require('mongoose');

const EpisodeSchema = new mongoose.Schema({
    tvshowId: { type: mongoose.Schema.Types.ObjectId, ref: 'TVShow', required: true, index: true },
    season:   { type: Number, required: true },
    episode:  { type: Number, required: true },
    title:    { type: String },
    overview: { type: String },
    // Ruta absoluta al archivo de video almacenado localmente (streaming RF11)
    localPath: { type: String, required: true },
});

// Índice compuesto para buscar episodio exacto en O(log n)
EpisodeSchema.index({ tvshowId: 1, season: 1, episode: 1 }, { unique: true });

module.exports = mongoose.model('Episode', EpisodeSchema);
