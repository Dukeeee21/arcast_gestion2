const mongoose = require('mongoose');

const playbackSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    contentId: {
        type: String,
        required: true
    },
    currentTime: {
        type: Number,
        required: true
    },
    duration: {
        type: Number,
        required: true
    },
    lastWatched: {
        type: Date,
        default: Date.now
    }
});

playbackSchema.index({ userId: 1, contentId: 1 }, { unique: true });

module.exports = mongoose.model('Playback', playbackSchema);