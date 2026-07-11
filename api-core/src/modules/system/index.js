const express = require('express');
const systemRoutes = require('./system.routes');

const router = express.Router();

// Exportamos las rutas del módulo de sistema
router.use('/', systemRoutes);

module.exports = router;