const express = require('express');
const router = express.Router();
const {
  sendNotification, getNotifications, markAsRead, markAllAsRead, deleteNotification,
} = require('../controllers/notificationController');
const { authenticate, authorize } = require('../middleware/auth');

// POST /api/notifications/send  (admin or teacher)
router.post('/send', authenticate, authorize('admin', 'teacher'), sendNotification);

// GET /api/notifications  (any authenticated user)
router.get('/', authenticate, getNotifications);

// PUT /api/notifications/read-all
router.put('/read-all', authenticate, markAllAsRead);

// PUT /api/notifications/:id/read
router.put('/:id/read', authenticate, markAsRead);

// DELETE /api/notifications/:id
router.delete('/:id', authenticate, deleteNotification);

module.exports = router;
