const express = require('express');
const router = express.Router();
const systemController = require('./system.controller');
const { requiredAuth, authorize } = require('../../common/auth.middleware');

// TEMPORAL: migración única de la base curada local -> Atlas para el despliegue.
// Body grande (incluye embeddings), por eso este límite propio y no el global.
router.post('/bulk-import', express.json({ limit: '20mb' }), requiredAuth, authorize(['admin']), systemController.bulkImport);

// Cualquiera puede ver la config (para que el front aplique el CSS), pero solo admin edita
router.get('/config', systemController.getConfig);
router.put('/config', requiredAuth, authorize(['admin']), systemController.updateConfig);

// Catálogos controlados (regiones, lenguas, fondos...) para poblar filtros/formularios.
router.get('/catalogs', systemController.getCatalogs);

// Registro de auditoría: solo admin
router.get('/audit', requiredAuth, authorize(['admin']), systemController.getAuditLogs);
router.get('/audit/verify', requiredAuth, authorize(['admin']), systemController.verifyAudit);

module.exports = router;