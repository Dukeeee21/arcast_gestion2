const express = require('express');
const router = express.Router();
const controller = require('./movies.controller');
const { requiredAuth, authorize } = require('../../common/auth.middleware');

// Roles operativos que pueden catalogar/gestionar contenido.
const staff = ['tecnico', 'admin'];
const supervisors = ['admin'];

// API Endpoints para Películas
router.get('/explore', controller.exploreMovies);
router.get('/', controller.getAllMovies);

// Listado de GESTIÓN (incluye borradores/pendientes/ocultos). Debe ir antes de
// '/:id' para que "manage" no se interprete como un id.
router.get('/manage', requiredAuth, authorize(staff), controller.getManagedMovies);

router.post('/', requiredAuth, authorize(staff), controller.createMovie);
router.get('/:id', controller.getMovieById);
router.get('/:id/attachments/:attId/download', controller.downloadAttachment);
router.put('/:id', requiredAuth, authorize(staff), controller.updateMovie);
router.delete('/:id', requiredAuth, authorize(supervisors), controller.deleteMovie);

// Flujo de aprobación
router.patch('/:id/submit', requiredAuth, authorize(staff), controller.submitForReview);
router.patch('/:id/approve', requiredAuth, authorize(supervisors), controller.approveMovie);
router.patch('/:id/reject', requiredAuth, authorize(supervisors), controller.rejectMovie);

module.exports = router;
