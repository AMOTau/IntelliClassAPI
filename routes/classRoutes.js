const express = require('express');
const router = express.Router();
const {
  createClass, getClasses, getClassById, enrollLearner, removeEnrollment, deleteClass,
} = require('../controllers/classController');
const { authenticate, authorize } = require('../middleware/auth');

// POST /api/classes  (teacher only)
router.post('/', authenticate, authorize('teacher'), createClass);

// GET /api/classes
router.get('/', authenticate, authorize('teacher', 'learner'), getClasses);

// GET /api/classes/:id
router.get('/:id', authenticate, authorize('teacher', 'learner', 'admin'), getClassById);

// POST /api/classes/:id/enroll  (teacher only)
router.post('/:id/enroll', authenticate, authorize('teacher'), enrollLearner);

// DELETE /api/classes/:id/enroll/:learnerId  (teacher only)
router.delete('/:id/enroll/:learnerId', authenticate, authorize('teacher'), removeEnrollment);

// DELETE /api/classes/:id  (teacher only)
router.delete('/:id', authenticate, authorize('teacher'), deleteClass);

module.exports = router;
