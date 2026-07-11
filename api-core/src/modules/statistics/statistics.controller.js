const statisticsService = require('./statistics.service');
const { catchAsync } = require('../../common/error.utils');
const { sendCSV } = require('../../common/csv.utils');
const PlaybackLog = require('./playback.model');
/** @type {any} */
const User = require('../users/user.model');

exports.getTrafficMetrics = catchAsync(async (req, res, _next) => {
    const days = parseInt(req.query.days) || 7;
    const data = await statisticsService.getTrafficPeaks(days);
    res.json(data);
});

exports.recordPlayback = catchAsync(async (req, res, _next) => {
    const { contentId, contentType, durationMinutes } = req.body;

    // Desnormalizamos la región del usuario en el registro para alimentar el mapa
    // de impacto territorial (Vista Jefe) sin tener que cruzar colecciones después.
    const user = await User.findById(req.user.id).select('region').lean();

    await PlaybackLog.create({
        userId: req.user.id,
        contentId, contentType, durationMinutes,
        region: user?.region || null,
    });
    res.status(201).json({ message: 'Tiempo de reproducción registrado exitosamente' });
});

exports.getPlaybackMetrics = catchAsync(async (req, res, _next) => {
    const days = parseInt(req.query.days) || 7;
    const data = await statisticsService.getAveragePlayback(days);
    res.json(data);
});

// Ranking público de lo más visto (sin datos personales): alimenta la fila
// "Tendencias" del catálogo. A diferencia del resto del módulo, no es admin-only.
exports.getTrending = catchAsync(async (req, res, _next) => {
    const limit = parseInt(req.query.limit) || 12;
    const data = await statisticsService.getTrending(limit);
    res.json(data);
});

// --- FASE 2: Vista Jefe ---

// Mapa de impacto territorial (reproducciones por región).
exports.getTerritorial = catchAsync(async (_req, res, _next) => {
    res.json(await statisticsService.getTerritorialImpact());
});

// Retorno Estatal (presupuesto cruzado con visualizaciones).
exports.getStateReturn = catchAsync(async (_req, res, _next) => {
    res.json(await statisticsService.getStateReturn());
});

// Exportación CSV de los reportes ejecutivos (legible por Excel).
exports.exportReport = catchAsync(async (req, res, _next) => {
    const report = String(req.query.report || 'territorial');

    if (report === 'state-return') {
        const data = await statisticsService.getStateReturn();
        return sendCSV(
            res,
            'retorno-estatal.csv',
            ['Region', 'Proyectos', 'Visualizaciones', 'Retorno Estimado (PEN)', 'Estado'],
            data.perRegion.map((r) => [r.region, r.projects, r.plays, r.retornoEstimado, r.estado]),
        );
    }

    // Por defecto: impacto territorial.
    const data = await statisticsService.getTerritorialImpact();
    return sendCSV(
        res,
        'impacto-territorial.csv',
        ['Region', 'Visualizaciones', 'Minutos', 'Proyectos', 'Ultima Reproduccion', 'Estado'],
        data.map((r) => [
            r.region, r.plays, r.minutes, r.projects,
            r.lastPlay ? new Date(r.lastPlay).toISOString().slice(0, 10) : '',
            r.estado,
        ]),
    );
});
