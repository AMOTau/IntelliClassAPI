const express = require('express');
const router = express.Router();
const {
  createQuiz, publishQuiz, getQuizzes, getQuizById, submitQuiz, getQuizResults, deleteQuiz,
} = require('../controllers/quizController');
const { authenticate, authorize } = require('../middleware/auth');

// POST /api/quizzes/create  (teacher only)
router.post('/create', authenticate, authorize('teacher'), createQuiz);

// GET /api/quizzes
router.get('/', authenticate, authorize('teacher', 'learner'), getQuizzes);

// GET /api/quizzes/:id
router.get('/:id', authenticate, authorize('teacher', 'learner'), getQuizById);

// PUT /api/quizzes/:id/publish  (teacher only)
router.put('/:id/publish', authenticate, authorize('teacher'), publishQuiz);

// POST /api/quizzes/:id/submit  (learner only)
router.post('/:id/submit', authenticate, authorize('learner'), submitQuiz);

// GET /api/quizzes/:id/results  (teacher only)
router.get('/:id/results', authenticate, authorize('teacher'), getQuizResults);

// DELETE /api/quizzes/:id  (teacher only)
router.delete('/:id', authenticate, authorize('teacher'), deleteQuiz);

module.exports = router;
