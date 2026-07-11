const express = require('express');
const router = express.Router();
const controller = require('./auth.controller');

router.post('/register', controller.registerUser);
router.post('/login', controller.loginUser);
router.post('/google', controller.googleLogin);

module.exports = router;