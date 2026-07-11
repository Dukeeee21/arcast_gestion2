const express    = require('express');
const router     = express.Router();
const jwt        = require('jsonwebtoken');
const controller = require('./streaming.controller');
const { requiredAuth } = require('../../common/auth.middleware');

// El tag <video> no puede enviar headers personalizados, por lo que
// el token se acepta también como query param: ?token=<jwt>
const streamAuth = (req, res, next) => {
    const header = req.header('x-auth-token') || req.header('Authorization');
    const raw    = header
        ? (header.startsWith('Bearer ') ? header.slice(7) : header)
        : req.query.token;

    if (!raw) return res.status(401).json({ message: 'No hay token.' });

    try {
        req.user = jwt.verify(raw, process.env.JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ message: 'Token no válido.' });
    }
};

// Rutas de streaming de video
router.get('/movie/:id',                          streamAuth, controller.streamMovie);
router.get('/episode/:tvshowId/:season/:episode', streamAuth, controller.streamEpisode);

// Rutas para el progreso de visualización
router.post('/progress',              requiredAuth, controller.saveProgress);
router.get('/progress/:contentId',    requiredAuth, controller.getProgress);
router.get('/continue-watching',             requiredAuth, controller.getContinueWatching);
router.get('/continue-watching/:userId',     requiredAuth, controller.getContinueWatching);
router.get('/history/:userId',               requiredAuth, controller.getHistory);

module.exports = router;
