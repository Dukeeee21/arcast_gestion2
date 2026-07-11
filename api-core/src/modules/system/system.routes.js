const express = require('express');
const router = express.Router();
const systemController = require('./system.controller');
const { requiredAuth, authorize } = require('../../common/auth.middleware');

// Cualquiera puede ver la config (para que el front aplique el CSS), pero solo admin edita
router.get('/config', systemController.getConfig);
router.put('/config', requiredAuth, authorize(['admin']), systemController.updateConfig);

// Catálogos controlados (regiones, lenguas, fondos...) para poblar filtros/formularios.
router.get('/catalogs', systemController.getCatalogs);

// Registro de auditoría: solo admin
router.get('/audit', requiredAuth, authorize(['admin']), systemController.getAuditLogs);
router.get('/audit/verify', requiredAuth, authorize(['admin']), systemController.verifyAudit);

module.exports = router;