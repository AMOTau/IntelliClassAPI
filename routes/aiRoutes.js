const express = require('express');
const router = express.Router();
const { generateQuiz } = require('../controllers/aiController');
const { authenticate, authorize } = require('../middleware/auth');

// POST /api/ai/generate-quiz  (teacher only)
router.post('/generate-quiz', authenticate, authorize('teacher'), generateQuiz);

module.exports = router;
