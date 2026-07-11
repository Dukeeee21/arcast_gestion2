const express = require("express");
const router = express.Router();
const userController = require("./user.controller");
const { requiredAuth, authorize } = require("../../common/auth.middleware");

router.get("/me", requiredAuth, userController.getMe);
router.get("/recommendations", requiredAuth, userController.getRecommendations);

router.get('/', requiredAuth, authorize(['admin']), userController.getAllUsers);
router.get('/me', requiredAuth, (req, res) => res.json(req.user));
router.put('/me', requiredAuth, userController.updateMe);
router.put('/update-password', requiredAuth, userController.updatePassword);
router.get('/stats', requiredAuth, authorize(['admin']), userController.getBossStats);
router.get('/activity', requiredAuth, authorize(['admin']), userController.getActivityMetrics);
router.put('/:id/role', requiredAuth, authorize(['admin']), userController.updateUserRole);
router.post('/watchlist', requiredAuth, userController.toggleWatchlist);
router.get('/watchlist', requiredAuth, userController.getWatchlist);
module.exports = router;
