const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, getAllUsers, toggleUserActive, getLearners } = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/users/profile
router.get('/profile', authenticate, getProfile);

// PUT /api/users/profile
router.put('/profile', authenticate, updateProfile);

// GET /api/users  (admin only)
router.get('/', authenticate, authorize('admin'), getAllUsers);

// GET /api/users/learners  (teacher only - learners in their classes)
router.get('/learners', authenticate, authorize('teacher'), getLearners);

// PUT /api/users/:id/toggle-active  (admin only)
router.put('/:id/toggle-active', authenticate, authorize('admin'), toggleUserActive);

module.exports = router;
