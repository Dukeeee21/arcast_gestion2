const express    = require('express');
const router     = express.Router({ mergeParams: true }); // hereda :tvshowId del padre
const controller = require('./episodes.controller');
const { requiredAuth, authorize } = require('../../common/auth.middleware');

const adminOnly = [requiredAuth, authorize(['admin'])];

// Listar episodios de una serie
router.get('/', controller.getEpisodes);

// Crear / actualizar / eliminar episodio (solo admin)
router.post('/',    ...adminOnly, controller.createEpisode);
router.put('/:id',  ...adminOnly, controller.updateEpisode);
router.delete('/:id', ...adminOnly, controller.deleteEpisode);

module.exports = router;
