const express = require('express');
const router = express.Router();
const searchController = require('./search.controller');

// POST /api/search/semantic
router.post('/semantic', searchController.semanticSearch);

module.exports = router;
