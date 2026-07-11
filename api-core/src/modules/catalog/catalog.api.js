/**
 * @type {any}
 */
const Movie = require('./movie.model');
/** @type {any} */
const TVShow = require('./tvshow.model');


module.exports = {
    // noinspection JSUnresolvedFunction
    getMovieById: async (id) => {
        return await Movie.findById(id);
    },

    // noinspection JSUnresolvedFunction
    getTVShowById: async (id) => {
        return await TVShow.findById(id);
    },

    getBulkItems: async (movieIds, tvIds) => {
        const [movies, tvshows] = await Promise.all([
            // noinspection JSUnresolvedFunction
            Movie.find({ _id: { $in: movieIds } }),
            // noinspection JSUnresolvedFunction
            TVShow.find({ _id: { $in: tvIds } })
        ]);
        return { movies, tvshows };
    },

    getRecommendedContent: async (tmdbIds) => {
        if (!tmdbIds || tmdbIds.length === 0) {
            // noinspection JSUnresolvedFunction
            return await Movie.find().sort({ voteAverage: -1 }).limit(10);
        }
        // noinspection JSUnresolvedFunction
        return await Movie.find({ tmdbId: { $in: tmdbIds } }).limit(10);
    }
};