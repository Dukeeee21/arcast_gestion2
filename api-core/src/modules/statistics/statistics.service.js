const AuditLog = require('../../common/audit.model');
const PlaybackLog = require('./playback.model');
/** @type {any} */
const Movie = require('../catalog/movie.model');
/** @type {any} */
const TVShow = require('../catalog/tvshow.model');

// Umbrales para clasificar el "Estado" de la actividad de una región según su
// última reproducción registrada.
const DAY = 24 * 60 * 60 * 1000;

function estadoFromLastPlay(lastPlay) {
    if (!lastPlay) return 'Sin actividad';
    const age = Date.now() - new Date(lastPlay).getTime();
    if (age <= 30 * DAY) return 'Activo';
    if (age <= 90 * DAY) return 'En Proceso';
    return 'Finalizado';
}

/**
 * Impacto territorial: reproducciones agrupadas por región (departamento) del
 * usuario. Alimenta el mapa de la Vista Jefe.
 */
exports.getTerritorialImpact = async () => {
    const rows = await PlaybackLog.aggregate([
        { $match: { region: { $ne: null } } },
        {
            $group: {
                _id: '$region',
                plays: { $sum: 1 },
                minutes: { $sum: '$durationMinutes' },
                contenidos: { $addToSet: '$contentId' },
                lastPlay: { $max: '$timestamp' },
            },
        },
        {
            $project: {
                _id: 0,
                region: '$_id',
                plays: 1,
                minutes: 1,
                projects: { $size: '$contenidos' },
                lastPlay: 1,
            },
        },
        { $sort: { plays: -1 } },
    ]);
    return rows.map((r) => ({ ...r, estado: estadoFromLastPlay(r.lastPlay) }));
};

/**
 * Retorno Estatal: cruza el presupuesto aprobado (dato financiero estático) con
 * las visualizaciones (dato dinámico) para obtener el costo por visualización y
 * distribuir el retorno por región según su cuota de consumo.
 */
exports.getStateReturn = async () => {
    const [budgetAgg] = await Movie.aggregate([
        { $match: { deletedAt: null } },
        {
            $group: {
                _id: null,
                totalBudget: { $sum: { $ifNull: ['$presupuestoAprobado', 0] } },
                fundedProjects: {
                    $sum: { $cond: [{ $gt: [{ $ifNull: ['$presupuestoAprobado', 0] }, 0] }, 1, 0] },
                },
            },
        },
    ]);

    const totalBudget = budgetAgg?.totalBudget || 0;
    const fundedProjects = budgetAgg?.fundedProjects || 0;
    const totalPlays = await PlaybackLog.countDocuments();
    const costPerView = totalPlays > 0 ? totalBudget / totalPlays : 0;

    const territorial = await exports.getTerritorialImpact();
    const perRegion = territorial.map((r) => ({
        region: r.region,
        projects: r.projects,
        plays: r.plays,
        // Retorno estimado = valor invertido "consumido" en esa región según su
        // cuota de reproducciones. Es una distribución del presupuesto por impacto.
        retornoEstimado: Math.round(costPerView * r.plays),
        estado: r.estado,
    }));

    return {
        totalBudget,
        fundedProjects,
        totalPlays,
        costPerView: Math.round(costPerView * 100) / 100,
        perRegion,
    };
};

/**
 * Obtiene los picos de tráfico agrupados por hora usando el registro de auditoría.
 * @param {number} days - Días a analizar hacia atrás.
 */
exports.getTrafficPeaks = async (days = 7) => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return await AuditLog.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        {
            $group: {
                _id: {
                    $dateToString: { format: "%Y-%m-%d %H:00", date: "$timestamp", timezone: "America/Lima" }
                },
                valor: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } },
        {
            $project: {
                _id: 0,
                fecha: "$_id",
                valor: 1
            }
        }
    ]);
};

/**
 * Obtiene el tiempo de reproducción promedio por día.
 * @param {number} days - Días a analizar hacia atrás.
 */
exports.getAveragePlayback = async (days = 7) => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return await PlaybackLog.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp", timezone: "America/Lima" } },
                promedio: { $avg: "$durationMinutes" }
            }
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, fecha: "$_id", valor: { $round: ["$promedio", 2] } } }
    ]);
};

/**
 * Contenido más reproducido (público, sin datos personales): agrupa las
 * reproducciones por obra y devuelve las N con más plays, con su ficha ya
 * resuelta. Alimenta la fila "Tendencias" del catálogo público.
 */
exports.getTrending = async (limit = 12) => {
    const rows = await PlaybackLog.aggregate([
        { $group: { _id: { contentId: '$contentId', contentType: '$contentType' }, plays: { $sum: 1 } } },
        { $sort: { plays: -1 } },
        { $limit: limit * 2 }, // margen por si algún contentId ya no existe
    ]);

    const movieIds = rows.filter(r => r._id.contentType === 'Movie').map(r => r._id.contentId);
    const tvIds = rows.filter(r => r._id.contentType === 'TVShow').map(r => r._id.contentId);

    const [movies, shows] = await Promise.all([
        Movie.find({ _id: { $in: movieIds }, deletedAt: null, visible: { $ne: false } }).lean(),
        TVShow.find({ _id: { $in: tvIds } }).lean(),
    ]);

    const movieMap = new Map(movies.map(m => [String(m._id), m]));
    const showMap = new Map(shows.map(s => [String(s._id), s]));

    const results = [];
    for (const row of rows) {
        const idStr = String(row._id.contentId);
        const doc = row._id.contentType === 'Movie' ? movieMap.get(idStr) : showMap.get(idStr);
        if (!doc) continue; // obra borrada/oculta: se omite del ranking público
        results.push({ ...doc, mediaType: row._id.contentType === 'Movie' ? 'movie' : 'tvshow', plays: row.plays });
        if (results.length >= limit) break;
    }
    return results;
};
