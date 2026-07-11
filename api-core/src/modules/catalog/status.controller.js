const { catchAsync } = require('../../common/error.utils');
const Movie = require('./movie.model');
const TVShow = require('./tvshow.model');
const Episode = require('./episode.model');

/**
 * Clasifica el origen de un contenido en algo REPRODUCIBLE dentro de Arcast.
 *
 * Reproducible = archivo local en media/ (via endpoint de streaming) o una URL
 * de video DIRECTA (archive.org/download o un archivo .mp4/.webm/…).
 *
 * SÍ cuenta como reproducible: un `watchLink` de YouTube con la película/serie
 * COMPLETA (se reproduce embebido en la app). El tráiler NO cuenta: ese va en
 * `trailerKey`, aparte.
 *
 * NO cuenta como reproducible: un `watchLink` que sea una página de plataforma
 * (Netflix, Cineplanet, etc.), porque no se puede reproducir dentro de la app.
 *
 * Devuelve { status, streamable }:
 *   status: 'local' | 'archive' | 'direct' | 'youtube' | 'external' | 'none'
 */
const isHttp = (u) => typeof u === 'string' && /^https?:\/\//i.test(u.trim());
const isArchive = (u) => typeof u === 'string' && /archive\.org/i.test(u);
const isYouTube = (u) =>
    typeof u === 'string' && /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)/i.test(u);
const VIDEO_EXT = /\.(mp4|m4v|webm|ogv|mkv|mov|avi)(\?.*)?$/i;
const isDirectVideo = (u) =>
    typeof u === 'string' && (VIDEO_EXT.test(u.trim()) || /archive\.org\/(download|serve)\//i.test(u));

function classifySource(localPath, watchLink) {
    const local = (localPath || '').trim();
    const link = (watchLink || '').trim();

    // 1) Archivo local (ruta de disco, no URL) → reproducible por el endpoint de streaming.
    if (local && !isHttp(local)) return { status: 'local', streamable: true };
    // 2) localPath es una URL de video directa.
    if (isHttp(local) && isDirectVideo(local)) return { status: isArchive(local) ? 'archive' : 'direct', streamable: true };
    // 3) watchLink es una URL de video directa (archive.org/download o .mp4, …).
    if (isDirectVideo(link)) return { status: isArchive(link) ? 'archive' : 'direct', streamable: true };
    // 4) watchLink de YouTube (película/serie completa) → reproducible embebido.
    if (isYouTube(link) || isYouTube(local)) return { status: 'youtube', streamable: true };
    // 5) Hay un enlace, pero es una página (plataforma) que NO se reproduce en la app.
    if (isHttp(local) || isHttp(link)) return { status: 'external', streamable: false };
    // 6) Sin ninguna fuente.
    return { status: 'none', streamable: false };
}

/**
 * GET /api/catalog/streaming-status  (solo admin)
 * Reporte de qué títulos se pueden REPRODUCIR de verdad y cuáles solo tienen
 * metadata / enlaces externos.
 */
exports.getStreamingStatus = catchAsync(async (req, res, _next) => {
    const [movies, tvshows, episodes] = await Promise.all([
        Movie.find().select('title posterUrl localPath watchLink releaseDate').lean(),
        TVShow.find().select('name posterUrl localPath watchLink firstAirDate').lean(),
        Episode.find().select('tvshowId localPath season episode').lean(),
    ]);

    const epByShow = {};
    for (const ep of episodes) {
        const key = String(ep.tvshowId);
        (epByShow[key] = epByShow[key] || []).push(ep);
    }

    const movieReport = movies.map((m) => {
        const { status, streamable } = classifySource(m.localPath, m.watchLink);
        return {
            _id: m._id,
            type: 'movie',
            title: m.title,
            posterUrl: m.posterUrl || null,
            year: (m.releaseDate || '').split('-')[0] || null,
            status,
            streamable,
            source: streamable ? (m.localPath || m.watchLink) : null,
        };
    });

    const tvReport = tvshows.map((t) => {
        const eps = epByShow[String(t._id)] || [];
        const epsWithSource = eps.filter((e) => classifySource(e.localPath).streamable);
        const own = classifySource(t.localPath, t.watchLink);

        const streamable = epsWithSource.length > 0 || own.streamable;

        let status;
        if (!streamable) status = own.status === 'external' ? 'external' : 'none';
        else if (eps.length > 0 && epsWithSource.length === eps.length) status = 'complete';
        else if (epsWithSource.length > 0) status = 'partial';
        else status = own.status; // sin episodios, pero con fuente propia directa

        return {
            _id: t._id,
            type: 'tvshow',
            title: t.name,
            posterUrl: t.posterUrl || null,
            year: (t.firstAirDate || '').split('-')[0] || null,
            status,
            streamable,
            episodesTotal: eps.length,
            episodesWithSource: epsWithSource.length,
        };
    });

    const all = [...movieReport, ...tvReport];
    const summary = {
        total: all.length,
        streamable: all.filter((i) => i.streamable).length,
        notStreamable: all.filter((i) => !i.streamable).length,
        movies: {
            total: movieReport.length,
            streamable: movieReport.filter((i) => i.streamable).length,
        },
        tvshows: {
            total: tvReport.length,
            streamable: tvReport.filter((i) => i.streamable).length,
        },
    };

    res.json({ summary, movies: movieReport, tvshows: tvReport });
});
