const express = require('express');
const router = express.Router();
const {
  createHomework, getHomework, getHomeworkById, submitHomework,
  gradeSubmission, getSubmissions, deleteHomework,
} = require('../controllers/homeworkController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

// POST /api/homework/create  (teacher only)
router.post('/create', authenticate, authorize('teacher'), upload.single('file'), createHomework);

// GET /api/homework
router.get('/', authenticate, authorize('teacher', 'learner'), getHomework);

// GET /api/homework/:id
router.get('/:id', authenticate, authorize('teacher', 'learner'), getHomeworkById);

// GET /api/homework/:id/submissions  (teacher only)
router.get('/:id/submissions', authenticate, authorize('teacher'), getSubmissions);

// POST /api/homework/submit  (learner only)
router.post('/submit', authenticate, authorize('learner'), upload.single('file'), submitHomework);

// PUT /api/homework/:id/grade  (teacher only)
router.put('/:id/grade', authenticate, authorize('teacher'), gradeSubmission);

// DELETE /api/homework/:id  (teacher only)
router.delete('/:id', authenticate, authorize('teacher'), deleteHomework);

module.exports = router;
