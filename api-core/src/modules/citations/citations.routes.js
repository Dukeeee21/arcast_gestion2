const express = require('express');
const router = express.Router();
const controller = require('./citations.controller');
const { requiredAuth } = require('../../common/auth.middleware');

router.get('/', requiredAuth, controller.getMyCitations);
router.post('/generate', requiredAuth, controller.generateCitation);
router.delete('/:id', requiredAuth, controller.deleteCitation);

module.exports = router;
