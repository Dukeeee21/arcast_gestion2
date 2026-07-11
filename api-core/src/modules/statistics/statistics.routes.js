const express = require('express');
const router = express.Router();
const statisticsController = require('./statistics.controller');

// Middleware de autenticación y autorización (nombres reales del proyecto)
const { requiredAuth, authorize } = require('../../common/auth.middleware');

const adminOnly = [requiredAuth, authorize(['admin'])];

// Solo los admins pueden ver las métricas
router.get('/traffic', ...adminOnly, statisticsController.getTrafficMetrics);
router.get('/playback', ...adminOnly, statisticsController.getPlaybackMetrics);

// Vista Jefe: impacto territorial, retorno estatal y exportación de reportes.
router.get('/territorial', ...adminOnly, statisticsController.getTerritorial);
router.get('/state-return', ...adminOnly, statisticsController.getStateReturn);
router.get('/export', ...adminOnly, statisticsController.exportReport);

// Ruta para registrar el tiempo consumido por el usuario
// Cualquier usuario logueado puede registrar su propio tiempo
router.post('/playback', requiredAuth, statisticsController.recordPlayback);

// Ranking público de lo más visto (agregado, sin datos personales) — alimenta
// la fila "Tendencias" del catálogo, visible para cualquiera.
router.get('/trending', statisticsController.getTrending);

module.exports = router;
