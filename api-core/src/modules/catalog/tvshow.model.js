const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const TVShowSchema = new Schema({
  name: { type: String, required: true },
  overview: { type: String },
  posterUrl: { type: String },
  backdropUrl: { type: String },
  tmdbId: { type: String }, // LIBERADO: Ya no es obligatorio para el contenido local
  firstAirDate: { type: String },
  genres: [{ type: String }],
  trailerKey: { type: String },
  voteAverage: { type: Number },
  seasons: { type: Number },
  languages: [{ type: String }],
  originCountry: [{ type: String }],

  // Array de plataformas
  platforms: [
    {
      name: String,
      logo: String,
      link: String,
    },
  ],

  watchLink: { type: String },

  // Búsqueda semántica: vector de embedding y el texto con el que se generó.
  embedding: { type: [Number], default: undefined, select: false },
  embeddingText: { type: String, select: false },
});

module.exports = mongoose.model("TVShow", TVShowSchema);
