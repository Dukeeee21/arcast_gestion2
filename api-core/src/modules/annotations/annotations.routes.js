const express = require('express');
const router = express.Router();
const controller = require('./annotations.controller');
const { requiredAuth } = require('../../common/auth.middleware');

// Todas las rutas exigen sesión: las notas son privadas del investigador.
router.get('/', requiredAuth, controller.getAllMine);
router.get('/:contentId', requiredAuth, controller.getMyAnnotations);
router.post('/', requiredAuth, controller.createAnnotation);
router.put('/:id', requiredAuth, controller.updateAnnotation);
router.delete('/:id', requiredAuth, controller.deleteAnnotation);

module.exports = router;
