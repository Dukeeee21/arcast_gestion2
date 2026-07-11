const express = require('express');
const userRoutes = require('./user.routes'); // ✅ Corregido: apuntaba a system.routes por error
const router = express.Router();

router.use('/', userRoutes);

module.exports = router;