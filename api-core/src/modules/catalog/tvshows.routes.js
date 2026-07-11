const express = require('express');
const router = express.Router();
const controller = require('./tvshows.controller');
const { requiredAuth, authorize } = require('../../common/auth.middleware');
const episodesRoutes = require('./episodes.routes');

router.get('/', controller.getAllTVShows);
router.get('/:id', controller.getTVShowById);
router.post('/', requiredAuth, authorize(['admin']), controller.createTVShow);
router.put('/:id', requiredAuth, authorize(['admin']), controller.updateTVShow);
router.delete('/:id', requiredAuth, authorize(['admin']), controller.deleteTVShow);

// Episodios locales de cada serie: /api/catalog/tvshows/:tvshowId/episodes
router.use('/:tvshowId/episodes', episodesRoutes);

module.exports = router;