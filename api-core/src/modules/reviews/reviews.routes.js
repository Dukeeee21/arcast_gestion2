const express = require('express');
const router = express.Router();
const reviewsController = require('./reviews.controller');
const { requiredAuth, authorize } = require('../../common/auth.middleware');

router.get('/', requiredAuth, authorize(['admin']), reviewsController.getAllReviews);

router.get('/movie/:movieId', reviewsController.getReviewsByMovie);
router.post('/', requiredAuth, reviewsController.createReview);
router.put('/:id', requiredAuth, reviewsController.updateReview);
router.delete('/:id', requiredAuth, reviewsController.deleteReview);
router.get('/me', requiredAuth, reviewsController.getMyReviews);

// Endpoint para obtener estadísticas de reseñas por película, servirá más adelante
router.get('/stats/:movieId', reviewsController.getReviewStats);
module.exports = router;