const express = require('express');

/**
 * @type {import('express').Router}
 */
const movieRoutes = (/** @type {any} */ (require('./movies.routes')));

/** @type {import('express').Router} */
const tvshowRoutes = (/** @type {any} */ (require('./tvshows.routes')));

/** @type {import('express').Router} */
const importRoutes = (/** @type {any} */ (require('./import.routes')));

const statusController = require('./status.controller');
const { requiredAuth, authorize } = require('../../common/auth.middleware');

const router = express.Router();

// Reporte de estado de streaming del catálogo (visibilidad admin)
router.get('/streaming-status', requiredAuth, authorize(['admin']), statusController.getStreamingStatus);

router.use('/movies', movieRoutes);
router.use('/tvshows', tvshowRoutes);
router.use('/import', importRoutes);

module.exports = router;