const express    = require('express');
const router     = express.Router();
const controller = require('./recommendations.controller');
const { requiredAuth } = require('../../common/auth.middleware');

router.post('/:userId', requiredAuth, controller.getRecommendations);

module.exports = router;
