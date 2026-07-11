const express = require('express');

/**
 * @type {import('express').Router}
 */
const authRoutes = (/** @type {any} */ (require('./auth.routes')));

const router = express.Router();

router.use('/', authRoutes);

module.exports = router;