const { catchAsync, AppError } = require('../../common/error.utils');
const streamingService = require('./streaming.service');
const Movie   = require('../catalog/movie.model');
const Episode = require('../catalog/episode.model');
const { isR2Configured, getSignedVideoUrl } = require('../../common/r2.util');

exports.streamMovie = catchAsync(async (req, res, _next) => {
    const { id } = req.params;

    let movie = null;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
        movie = await Movie.findById(id).select('localPath r2Key title');
    }

    if (!movie) {
        movie = await Movie.findOne({ tmdbId: id }).select('localPath r2Key title');
    }

    if (!movie) throw new AppError('Película no encontrada', 404);

    // Despliegue público: el video vive en R2, no en el disco del servidor.
    // Redirigimos a una URL firmada temporal; el navegador transmite directo
    // desde Cloudflare (soporta Range de forma nativa, sin costo de egreso).
    if (movie.r2Key && isR2Configured()) {
        const url = await getSignedVideoUrl(movie.r2Key);
        return res.redirect(302, url);
    }

    if (!movie.localPath) throw new AppError('Esta película no tiene archivo local disponible', 404);
    streamingService.streamVideo(movie.localPath, req, res);
});

exports.streamEpisode = catchAsync(async (req, res, _next) => {
    const { tvshowId, season, episode } = req.params;

    const ep = await Episode.findOne({
        tvshowId,
        season:  Number(season),
        episode: Number(episode),
    }).select('localPath title');

    if (!ep)           throw new AppError('Episodio no encontrado', 404);
    if (!ep.localPath) throw new AppError('Este episodio no tiene archivo local disponible', 404);

    streamingService.streamVideo(ep.localPath, req, res);
});

exports.saveProgress = catchAsync(async (req, res, next) => {
    const { contentId, currentTime, duration } = req.body;
    const userId = req.user.id;

    if (!contentId || currentTime === undefined || duration === undefined) {
        return next(new AppError('Faltan parámetros: contentId, currentTime y duration son requeridos', 400));
    }

    const progress = await streamingService.saveOrUpdateProgress(userId, contentId, currentTime, duration);
    res.status(200).json({ status: 'success', data: { progress } });
});

exports.getProgress = catchAsync(async (req, res, next) => {
    const { contentId } = req.params;
    const userId = req.user.id;

    const progress = await streamingService.getProgress(userId, contentId);

    if (!progress) {
        return next(new AppError('No se encontró progreso para este contenido', 404));
    }

    res.status(200).json({ status: 'success', data: { progress } });
});

exports.getContinueWatching = catchAsync(async (req, res, _next) => {
    const userId = req.params.userId || req.user.id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;

    const result = await streamingService.getContinueWatchingList(userId, page, limit);
    
    res.status(200).json({ 
        status: 'success', 
        results: result.list.length, 
        data: { list: result.list },
        pagination: {
            total: result.total,
            page: result.page,
            pages: result.pages
        }
    });
});

exports.getHistory = catchAsync(async (req, res, _next) => {
    const userId = req.params.userId;
    const { type, from, to } = req.query;

    const list = await streamingService.getHistory(userId, { type, from, to });

    res.status(200).json({ status: 'success', results: list.length, data: { list } });
});
