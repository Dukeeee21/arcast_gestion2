const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ReviewSchema = new Schema({
    movieId: { type: String, required: true },
    movieTitle: { type: String, required: false },
    username: { type: String, required: true },
    text: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    date: { type: Date, default: Date.now },
    userId: { type: Schema.Types.ObjectId, required: false },
    contentType: { type: String, default: 'movie' }
});

module.exports = mongoose.model('Review', ReviewSchema);