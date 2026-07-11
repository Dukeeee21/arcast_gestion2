const express = require('express');
const router = express.Router();
const reviewsRoutes = require('./reviews.routes');

router.use('/', reviewsRoutes);

module.exports = router;