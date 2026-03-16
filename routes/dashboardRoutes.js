const express = require('express');
const router = express.Router();
const { teacherDashboard, learnerDashboard, parentDashboard, adminDashboard } = require('../controllers/dashboardController');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/dashboard/teacher
router.get('/teacher', authenticate, authorize('teacher'), teacherDashboard);

// GET /api/dashboard/learner
router.get('/learner', authenticate, authorize('learner'), learnerDashboard);

// GET /api/dashboard/parent
router.get('/parent', authenticate, authorize('parent'), parentDashboard);

// GET /api/dashboard/admin
router.get('/admin', authenticate, authorize('admin'), adminDashboard);

module.exports = router;
