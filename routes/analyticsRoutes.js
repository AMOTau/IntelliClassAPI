const express = require('express');
const router = express.Router();
const { classPerformance, learnerPerformance, leaderboard } = require('../controllers/analyticsController');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/analytics/class-performance  (teacher only)
router.get('/class-performance', authenticate, authorize('teacher'), classPerformance);

// GET /api/analytics/learner-performance  (teacher, parent, learner)
router.get('/learner-performance', authenticate, authorize('teacher', 'learner', 'parent'), learnerPerformance);

// GET /api/analytics/leaderboard  (teacher only)
router.get('/leaderboard', authenticate, authorize('teacher'), leaderboard);

module.exports = router;
