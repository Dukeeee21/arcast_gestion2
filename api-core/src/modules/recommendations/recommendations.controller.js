const { catchAsync, AppError } = require('../../common/error.utils');
const User    = require('../users/user.model');
const Movie   = require('../catalog/movie.model');
const TVShow  = require('../catalog/tvshow.model');
const { extractPreferredGenres, getRecommendations } = require('./recommendations.service');

const PROJECTION = 'title name posterUrl tmdbId genres releaseDate voteAverage mediaType overview';

/**
 * Resuelve una lista de tmdbIds a documentos reales de la BD.
 * Para los IDs que no existen, rellena con películas de los géneros preferidos.
 */
async function resolveToDocuments(tmdbIds, preferredGenres, watchedIds, limit) {
    const watchedSet = new Set(watchedIds.map(String));

    // 1. Buscar en BD los tmdbIds que devolvió el motor IA
    const [movies, tvshows] = await Promise.all([
        Movie.find({ tmdbId: { $in: tmdbIds } }).select(PROJECTION).lean(),
        TVShow.find({ tmdbId: { $in: tmdbIds } }).select(PROJECTION).lean(),
    ]);

    const found = [
        ...movies.map(m => ({ ...m, mediaType: 'movie' })),
        ...tvshows.map(t => ({ ...t, mediaType: 'tvshow' })),
    ].filter(d => !watchedSet.has(String(d._id)));

    if (found.length >= limit) return found.slice(0, limit);

    // 2. Fallback: completar con contenido de los géneros preferidos en la BD
    const needed = limit - found.length;
    const foundIds = new Set(found.map(d => String(d._id)));

    const genreFilter = preferredGenres.length
        ? { genres: { $in: preferredGenres } }
        : {};

    const [moreMovies, moreTVShows] = await Promise.all([
        Movie.find(genreFilter).select(PROJECTION).limit(needed * 3).lean(),
        TVShow.find(genreFilter).select(PROJECTION).limit(needed * 3).lean(),
    ]);

    const extras = [
        ...moreMovies.map(m => ({ ...m, mediaType: 'movie' })),
        ...moreTVShows.map(t => ({ ...t, mediaType: 'tvshow' })),
    ]
        .filter(d => !watchedSet.has(String(d._id)) && !foundIds.has(String(d._id)))
        .sort(() => Math.random() - 0.5)
        .slice(0, needed);

    return [...found, ...extras];
}

/**
 * POST /api/recommendations/:userId
 * Devuelve documentos reales del catálogo recomendados por la IA.
 */
exports.getRecommendations = catchAsync(async (req, res, next) => {
    const { userId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 5, 10);

    if (req.user.id !== userId && req.user.role !== 'admin') {
        return next(new AppError('No tienes permiso para ver las recomendaciones de otro usuario', 403));
    }

    const user = await User.findById(userId).select('watchHistory watchlist');
    if (!user) return next(new AppError('Usuario no encontrado', 404));

    const watchedIds     = user.watchHistory.map(h => h.contentId);
    const preferredGenres = extractPreferredGenres(user.watchHistory, user.watchlist);

    // Pedir tmdbIds al motor IA
    const aiResult = await getRecommendations(userId, preferredGenres, watchedIds, limit);

    // Resolver esos IDs a documentos reales de la BD (con fallback por género)
    const items = await resolveToDocuments(
        aiResult.recommendations,
        preferredGenres,
        watchedIds,
        limit,
    );

    res.json({
        status: 'success',
        data: {
            userId,
            preferredGenres,
            items,
            engine: aiResult.engine,
            metadata: aiResult.metadata,
            justification: preferredGenres.length
                ? `Recomendaciones basadas en tus géneros más vistos: ${preferredGenres.slice(0, 3).join(', ')}.`
                : 'Recomendaciones generales — agrega contenido a tu historial para personalizarlas.',
        },
    });
});
