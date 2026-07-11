/** @type {any} */
const SystemConfig = require('./system.model');
/** @type {any} */
const AuditLog = require('../../common/audit.model');
const audit = require('../../common/audit.service');
const catalogs = require('../../common/catalogs');
const { catchAsync } = require('../../common/error.utils');

// Expone los catálogos controlados para que la UI pinte filtros/selects sin
// hardcodear valores (regiones, lenguas, fondos, estados, roles).
exports.getCatalogs = catchAsync(async (_req, res, _next) => {
    res.json({
        regionesNaturales: catalogs.REGIONES_NATURALES,
        departamentos: catalogs.DEPARTAMENTOS,
        lenguas: catalogs.LENGUAS,
        fondosEstatales: catalogs.FONDOS_ESTATALES,
        estadosPublicacion: catalogs.ESTADOS_PUBLICACION,
        roles: catalogs.ROLES,
    });
});

exports.getConfig = catchAsync(async (req, res, _next) => {
    // noinspection JSUnresolvedFunction
    let config = await SystemConfig.findOne({ key: 'global_settings' });
    if (!config) {
        // noinspection JSUnresolvedFunction
        config = await SystemConfig.create({ key: 'global_settings' });
    }
    res.json(config);
});

exports.updateConfig = catchAsync(async (req, res, _next) => {
    const { customCSS, customJS, maintenanceMode } = req.body;
    // noinspection JSUnresolvedFunction
    const config = await SystemConfig.findOneAndUpdate(
        { key: 'global_settings' },
        { customCSS, customJS, maintenanceMode, updatedBy: req.user.username },
        /** @type {any} */ ({ upsert: true, new: true })
    );

    await audit.recordMutation(req.user.id, 'SYSTEM_UI_MUTATION', { maintenance: maintenanceMode }, req.ip);
    res.json(config);
});
exports.getAuditLogs = catchAsync(async (req, res, _next) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    // noinspection JSUnresolvedFunction
    const logs = await AuditLog.find()
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();
    res.json(logs);
});

// Verifica que la cadena de hashes de la auditoría no haya sido alterada.
exports.verifyAudit = catchAsync(async (_req, res, _next) => {
    const result = await audit.verifyChain();
    res.json(result);
});