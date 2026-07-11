/** @type {any} */
const Movie = require('./movie.model');
const TVShow = require('./tvshow.model');

/** @type {any} */
const audit = require('../../common/audit.service');

const { catchAsync, AppError } = require('../../common/error.utils');

/** @type {any} */
const tmdbProvider = require('./providers/tmdb.provider');

/**
 * VISTA ADMIN: Importación agnóstica al proveedor
 */
exports.importMovie = catchAsync(async (req, res, next) => {
    const { externalId, provider = 'tmdb' } = req.body;

    if (!externalId) return next(new AppError('Se requiere un ID externo.', 400));

    let movieData;

    if (provider === 'tmdb') {
        // noinspection JSUnresolvedFunction
        movieData = await tmdbProvider.getMovieDetails(externalId);
    } else {
        return next(new AppError(`El proveedor '${provider}' no está implementado.`, 400));
    }

    // noinspection JSUnresolvedFunction
    let movieExists = await Movie.findOne({ tmdbId: movieData.tmdbId });

    if (movieExists) {
        return next(new AppError('Este contenido ya existe en el catálogo.', 400));
    }

    const movie = new Movie(movieData);
    await movie.save();

    await audit.recordMutation(req.user.id, 'CATALOG_IMPORT', {
        title: movie.title,
        source: provider
    }, req.ip);

    res.status(201).json({ status: 'success', data: movie });
});

/**
 * Nota: Implementar importTVShow siguiendo el mismo patrón de Movie.
 */
exports.importTVShow = catchAsync(async (req, res, next) => {
    const { externalId, provider = 'tmdb' } = req.body;

    if (!externalId) return next(new AppError('Se requiere un ID externo.', 400));

    let tvData;

    if (provider === 'tmdb') {
        tvData = await tmdbProvider.getTVShowDetails(externalId);
    } else {
        return next(new AppError(`El proveedor '${provider}' no está implementado.`, 400));
    }

    let tvExists = await TVShow.findOne({ tmdbId: tvData.tmdbId });

    if (tvExists) {
        return next(new AppError('Este contenido ya existe en el catálogo.', 400));
    }

    const tvshow = new TVShow(tvData);
    await tvshow.save();

    await audit.recordMutation(req.user.id, 'CATALOG_IMPORT_TV', {
        title: tvshow.title,
        source: provider
    }, req.ip);

    res.status(201).json({ status: 'success', data: tvshow });
});

exports.importPeruvianMovies = catchAsync(async (req, res, _next) => {
    const { pages = 1 } = req.body;
    let imported = 0;
    let skipped = 0;

    for (let page = 1; page <= pages; page++) {
        const { results } = await tmdbProvider.getPeruvianMovies(page);

        for (const item of results) {
            const exists = await Movie.findOne({ tmdbId: String(item.id) });
            if (exists) { skipped++; continue; }

            const details = await tmdbProvider.getMovieDetails(item.id);
            const movie = new Movie(details);
            await movie.save();
            imported++;
        }
    }

    await audit.recordMutation(req.user.id, 'CATALOG_BULK_IMPORT', {
        source: 'tmdb',
        country: 'PE',
        imported,
        skipped
    }, req.ip);

    res.status(201).json({ status: 'success', imported, skipped });
});